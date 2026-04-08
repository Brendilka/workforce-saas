import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";
import { getOpenAIClient } from "@/lib/openai";
import { getUser, getUserRole } from "@/lib/supabase/server";

interface AwardConfigRequestBody {
  companyDetails: string;
  industry: string;
  location: string;
  payCodes: string;
  policies: string;
  awardTable?: Array<Record<string, unknown>>;
}

type LiveDocument = {
  type: "Award" | "EBA";
  name: string;
  code?: string;
  sourceUrl: string;
  printId?: string;
  matterNumber?: string;
  industry?: string;
  awardType?: string;
  status?: string;
  approvalDate?: string;
  expiryDate?: string;
};

const FWC_BASE_URL = "https://dms.fwc.gov.au";

function normalizeText(value?: string) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function parseDocumentCode(title: string) {
  const match = title.match(/\[([^\]]+)\]/);
  return match?.[1] ? match[1].trim() : "";
}

function buildPrompt(body: AwardConfigRequestBody, foundDocuments: LiveDocument[]) {
  const { companyDetails, industry, location, payCodes, policies, awardTable } = body;
  let prompt = `You are an Australian payroll AI assistant with expertise in Fair Work awards and enterprise agreements. `;
  prompt += `Based on the company description, industry, location, pay codes, policy details, and live government documents, identify the most applicable award(s) and enterprise agreement(s). `;
  prompt += `Return only valid JSON with two top-level fields: \"foundDocuments\" and \"extractedConfig\". `;
  prompt += `Use the company information and the live Fair Work Commission documents below as the source of truth. `;
  prompt += `For each found document, include type (Award or EBA), code or id, name, matterNumber, industry, expiryDate, and approvalDate when available. `;
  prompt += `For extractedConfig, include ordinaryHours, overtime, shiftPenalties, allowances, rounding, leave, and publicHoliday sections. `;
  prompt += `Avoid any explanation outside the JSON. `;

  prompt += `\n\nCompany Details:\n${companyDetails}\n`;
  prompt += `Industry: ${industry}\n`;
  prompt += `Location: ${location}\n`;
  prompt += `Pay Codes: ${payCodes}\n`;
  prompt += `Company Policies: ${policies}\n`;

  if (foundDocuments.length > 0) {
    prompt += `\nLive Fair Work Commission Documents:\n`;
    prompt += foundDocuments
      .map((document) => {
        const pieces = [`- ${document.type}: ${document.name}`];
        if (document.code) pieces.push(`code: ${document.code}`);
        if (document.printId) pieces.push(`printId: ${document.printId}`);
        if (document.industry) pieces.push(`industry: ${document.industry}`);
        if (document.status) pieces.push(`status: ${document.status}`);
        pieces.push(`url: ${document.sourceUrl}`);
        return pieces.join(" | ");
      })
      .join("\n");
    prompt += `\nUse these documents to guide the configuration extraction.\n`;
  }

  if (awardTable && awardTable.length > 0) {
    prompt += `\nAward/EBA Table (JSON):\n${JSON.stringify(awardTable, null, 2)}\n`;
    prompt += `Choose applicable rows from this table and extract the relevant payroll parameters based on the company information.`;
  } else {
    prompt += `\nIf no award table is provided, use your knowledge of Australian Fair Work awards and enterprise agreements to infer likely matches.`;
  }

  prompt += `\n\nResponse format example:\n{\n  \"foundDocuments\": [\n    {\"type\": \"Award\", \"code\": \"MA000013\", \"name\": \"Mining Industry Award 2020\", \"matterNumber\": \"M2019/013\", \"industry\": \"Mining\", \"expiryDate\": \"2024-12-31\"}\n  ],\n  \"extractedConfig\": { ... }\n}`;

  return prompt;
}

async function fetchFwcDocumentDetails(sourceUrl: string) {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AwardConfigBot/1.0; +https://dms.fwc.gov.au)",
      },
    });

    if (!response.ok) {
      return {};
    }

    const html = await response.text();
    const detail$ = load(html);
    const printId = normalizeText(detail$(".fwc-field--name-field-print-id .fwc-field__item").text());
    const matterNumber = normalizeText(
      detail$(
        ".fwc-field--name-field-award-matter-number .fwc-field__item, .fwc-field--name-field-agreement-matter-number .fwc-field__item, .fwc-field--name-field-matter-number .fwc-field__item"
      ).text()
    );
    const approvalDate = normalizeText(
      detail$(
        ".fwc-field--name-field-approval-date .fwc-field__item, .fwc-field--name-field-document-approved-date .fwc-field__item, .fwc-field--name-field-date-of-approval .fwc-field__item"
      ).text()
    );
    const expiryDate = normalizeText(
      detail$(
        ".fwc-field--name-field-expiry-date .fwc-field__item, .fwc-field--name-field-document-expiry-date .fwc-field__item"
      ).text()
    );

    const dynamicJsonText = normalizeText(detail$(".fwc-field--name-field-dynamic-fields .jsonb-viewer-formatted").text());
    let dynamicFields: Record<string, unknown> | null = null;

    if (dynamicJsonText) {
      try {
        dynamicFields = JSON.parse(dynamicJsonText);
      } catch {
        dynamicFields = null;
      }
    }

    return {
      printId: printId || (dynamicFields?.["PrintId"] as string) || undefined,
      matterNumber: matterNumber || undefined,
      approvalDate: approvalDate || undefined,
      expiryDate: expiryDate || undefined,
      industry: dynamicFields?.["AwardIndustry"] as string | undefined,
      status: dynamicFields?.["Awardstatus"] as string | undefined,
      awardType: dynamicFields?.["AwardType"] as string | undefined,
    };
  } catch (error) {
    console.error(`Failed to fetch document details for ${sourceUrl}:`, error);
    return {};
  }
}

async function fetchFwcSearchResults(query: string, interfaceType: "awards" | "agreements", maxResults = 3) {
  const searchUrl = `${FWC_BASE_URL}/search/${interfaceType}?q=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AwardConfigBot/1.0; +https://dms.fwc.gov.au)",
    },
  });

  if (!response.ok) {
    return [] as LiveDocument[];
  }

  const html = await response.text();
  const $ = load(html);
  const rows = $(".view-content .views-row").toArray().slice(0, maxResults);

  const documents: LiveDocument[] = [];

  for (const row of rows) {
    const row$ = $(row);
    const title = normalizeText(row$.find("h3.result-title a").text());
    const relativeHref = normalizeText(row$.find("h3.result-title a").attr("href") || "");
    if (!title || !relativeHref) {
      continue;
    }

    const sourceUrl = new URL(relativeHref, FWC_BASE_URL).toString();
    const code = parseDocumentCode(title);

    const chips = row$.find(".fwc-chip").toArray();
    const metadata: Record<string, string> = {};
    chips.forEach((chip) => {
      const chipTitle = normalizeText($(chip).attr("title") || "");
      const chipText = normalizeText($(chip).text());
      if (chipTitle.includes("Industry")) {
        metadata.industry = chipText;
      }
      if (chipTitle.includes("Award Status") || chipTitle.includes("Agreement Status")) {
        metadata.status = chipText;
      }
      if (chipTitle.includes("Award Type") || chipTitle.includes("Document Type")) {
        metadata.awardType = chipText;
      }
      if (chipTitle.includes("Referring State")) {
        metadata.industry = metadata.industry ? `${metadata.industry} (${chipText})` : chipText;
      }
    });

    const details = await fetchFwcDocumentDetails(sourceUrl);
    documents.push({
      type: interfaceType === "awards" ? "Award" : "EBA",
      name: title,
      code,
      sourceUrl,
      industry: metadata.industry || details.industry,
      awardType: metadata.awardType || details.awardType,
      status: metadata.status || details.status,
      printId: details.printId,
      matterNumber: details.matterNumber,
      approvalDate: details.approvalDate,
      expiryDate: details.expiryDate,
    });
  }

  return documents;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const role = await getUserRole();

    if (!user || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as AwardConfigRequestBody;
    const { companyDetails, industry, location, payCodes, policies } = body;

    if (!companyDetails || !industry) {
      return NextResponse.json({ error: "companyDetails and industry are required" }, { status: 400 });
    }

    const searchTerm = [companyDetails, industry, location, policies, payCodes]
      .filter(Boolean)
      .join(" ")
      .slice(0, 240);

    const interfaces: Array<"awards" | "agreements"> = ["awards"];
    const lowerText = `${companyDetails} ${industry} ${policies}`.toLowerCase();
    if (/(agreement|enterprise agreement|eba|collective agreement|enterprise)/i.test(lowerText)) {
      interfaces.push("agreements");
    }

    const liveDocuments = (
      await Promise.all(interfaces.map((searchInterface) => fetchFwcSearchResults(searchTerm, searchInterface, 3)))
    ).flat();

    const prompt = buildPrompt(body, liveDocuments);
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: prompt,
      max_output_tokens: 1200,
    });

    const rawText = typeof response.output_text === "string" ? response.output_text.trim() : "";

    if (!rawText) {
      return NextResponse.json({ error: "Empty model response", foundDocuments: liveDocuments }, { status: 502 });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      const match = rawText.match(/\{[\s\S]*\}$/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return NextResponse.json(
          {
            error: "AI response could not be parsed as JSON",
            rawText,
            foundDocuments: liveDocuments,
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      ...parsed,
      foundDocuments: parsed.foundDocuments || liveDocuments,
    });
  } catch (error) {
    console.error("Error in /api/admin/award-config/process:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

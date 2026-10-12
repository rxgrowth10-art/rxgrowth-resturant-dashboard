const GHL_BASE_URL = "https://services.leadconnectorhq";
const API_VERSION = "v3";
const LOCATION_ID = "A0gpQEZUjXc6m3mzsCUH";

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

const EXPECTED_STAGES = [
  "NEW ORDER",
  "SUBMITTED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT FOR DELIVERY",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
];

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

async function ghlRequest(path, params = {}) {
  const token = process.env.GHL_API_KEY;

  if (!token) {
    throw new Error("GHL_API_KEY is not configured");
  }

  const url = new URL(`${GHL_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Version: API_VERSION,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error("HighLevel API request failed:", {
      endpoint: path,
      status: response.status,
      response: responseText.slice(0, 500),
    });

    throw new Error(
      `HighLevel API returned HTTP ${response.status}`
    );
  }

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    console.error("HighLevel API returned invalid JSON:", {
      endpoint: path,
      response: responseText.slice(0, 300),
    });

    throw new Error("HighLevel API returned invalid JSON");
  }

  return result;
}

async function fetchPipelines() {
  const result = await ghlRequest(
    "/opportunities/pipelines",
    {
      locationId: LOCATION_ID,
    }
  );

  if (!Array.isArray(result.pipelines)) {
    throw new Error("Unexpected Pipelines API response");
  }

  return result.pipelines;
}

function findOrdersPipeline(pipelines) {
  const acceptedNames = new Set([
    "ORDERS",
    "ORDERS PIPELINE",
  ]);

  const matches = pipelines.filter((pipeline) =>
    acceptedNames.has(normalizeName(pipeline.name))
  );

  if (matches.length === 0) {
    throw new Error("Orders Pipeline was not found");
  }

  if (matches.length > 1) {
    throw new Error(
      "Multiple Orders pipelines found; configuration is ambiguous"
    );
  }

  return matches[0];
}

async function fetchPipelineOpportunities(pipelineId) {
  const opportunities = [];
  const seenIds = new Set();

  let expectedTotal = null;
  let page = 1;
  let pagesFetched = 0;

  while (
    expectedTotal === null ||
    opportunities.length < expectedTotal
  ) {
    pagesFetched += 1;

    if (pagesFetched > MAX_PAGES) {
      throw new Error(
        "Opportunities pagination limit exceeded"
      );
    }

    const result = await ghlRequest(
      "/opportunities/search",
      {
        locationId: LOCATION_ID,
        pipelineId,
        status: "all",
        page,
        limit: PAGE_SIZE,
      }
    );

    if (!Array.isArray(result.opportunities)) {
      throw new Error(
        "Unexpected Opportunities API response"
      );
    }

    const reportedTotal = result.meta?.total;

    if (!Number.isFinite(reportedTotal)) {
      throw new Error(
        "Opportunities API total is missing or invalid"
      );
    }

    if (expectedTotal === null) {
      expectedTotal = reportedTotal;
    }

    for (const opportunity of result.opportunities) {
      if (!opportunity.id) {
        continue;
      }

      if (seenIds.has(opportunity.id)) {
        continue;
      }

      if (opportunity.pipelineId !== pipelineId) {
        continue;
      }

      seenIds.add(opportunity.id);
      opportunities.push(opportunity);
    }

    if (result.opportunities.length === 0) {
      break;
    }

    page += 1;
  }

  return {
    opportunities,
    reportedTotal: expectedTotal,
    pagesFetched,
  };
}

function calculateStageCounts(pipeline, opportunities) {
  const pipelineStages = Array.isArray(pipeline.stages)
    ? pipeline.stages
    : [];

  const counts = new Map();

  for (const stage of pipelineStages) {
    counts.set(stage.id, 0);
  }

  let opportunitiesWithoutKnownStage = 0;

  for (const opportunity of opportunities) {
    const stageId = opportunity.pipelineStageId;

    if (counts.has(stageId)) {
      counts.set(
        stageId,
        counts.get(stageId) + 1
      );
    } else {
      opportunitiesWithoutKnownStage += 1;
    }
  }

  const stages = pipelineStages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    count: counts.get(stage.id) || 0,
  }));

  const actualStageNames = stages.map((stage) =>
    normalizeName(stage.name)
  );

  const expectedStagesMatch =
    EXPECTED_STAGES.length === actualStageNames.length &&
    EXPECTED_STAGES.every(
      (name, index) => name === actualStageNames[index]
    );

  return {
    stages,
    expectedStagesMatch,
    expectedStages: EXPECTED_STAGES,
    opportunitiesWithoutKnownStage,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const pipelines = await fetchPipelines();
    const pipeline = findOrdersPipeline(pipelines);

    const {
      opportunities,
      reportedTotal,
      pagesFetched,
    } = await fetchPipelineOpportunities(pipeline.id);

    const metrics = calculateStageCounts(
      pipeline,
      opportunities
    );

    return res.status(200).json({
      success: true,
      source: "highlevel_opportunities",

      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
      },

      data: {
        totalOpportunities: opportunities.length,
        stages: metrics.stages,
        opportunitiesWithoutKnownStage:
          metrics.opportunitiesWithoutKnownStage,
      },

      validation: {
        expectedStagesMatch: metrics.expectedStagesMatch,
        expectedStages: metrics.expectedStages,
        actualStageNames: metrics.stages.map(
          (stage) => stage.name
        ),
      },

      diagnostics: {
        apiReportedTotal: reportedTotal,
        opportunitiesFetched: opportunities.length,
        pagesFetched,
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "Fulfillment API failed:",
      error.message
    );

    return res.status(500).json({
      success: false,
      error: "Unable to calculate fulfillment metrics",
    });
  }
}

/**
 * Central API Client for Prior Authorization System
 *
 * Frontend-only API integration.
 *
 * Backend base:
 *   http://localhost:8000
 *
 * API prefix:
 *   /api/v1
 *
 * IMPORTANT:
 * - Do NOT change the FastAPI backend.
 * - Callers can pass normal JavaScript objects as payloads.
 * - This client serializes objects exactly once.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const API_PREFIX = "/api/v1";
const API_URL = `${API_BASE_URL}${API_PREFIX}`;

/* ============================================================
   HELPERS
   ============================================================ */

/**
 * Convert FastAPI validation errors into a readable message.
 */
function formatApiError(data, status) {
  if (!data) {
    return `HTTP ${status}`;
  }

  // FastAPI validation error
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        const location = Array.isArray(item.loc)
          ? item.loc.join(".")
          : "";

        return location
          ? `${location}: ${item.msg || "Validation error"}`
          : item.msg || "Validation error";
      })
      .join("\n");
  }

  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (typeof data.message === "string") {
    return data.message;
  }

  if (typeof data === "string") {
    return data;
  }

  return `HTTP ${status}`;
}

/**
 * Serialize request bodies exactly once.
 *
 * Normal frontend usage:
 *
 *   request("POST", "/authorizations", {
 *     body: payload
 *   })
 *
 * If the caller already passes a JSON string, we leave it alone.
 */
function prepareBody(body) {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === "string") {
    return body;
  }

  return JSON.stringify(body);
}

/**
 * Generic HTTP request helper.
 */
async function request(method, endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;

  const {
    body,
    headers = {},
    ...restOptions
  } = options;

  const preparedBody = prepareBody(body);

  const config = {
    method,
    ...restOptions,
    headers: {
      Accept: "application/json",
      "X-Role": localStorage.getItem("pa-role") || "insurer",
      ...headers,
    },
  };

  if (preparedBody !== undefined) {
    config.body = preparedBody;

    // Only add JSON content type when we are sending JSON.
    if (!config.headers["Content-Type"]) {
      config.headers["Content-Type"] = "application/json";
    }
  }

  try {
    const response = await fetch(url, config);

    const contentType = response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message = formatApiError(data, response.status);

      const error = new Error(message);

      error.status = response.status;
      error.data = data;
      error.url = url;

      throw error;
    }

    return data;
  } catch (error) {
    if (
      error instanceof TypeError &&
      !error.status
    ) {
      throw new Error(
        `Network error: Unable to connect to backend at ${API_URL}.`,
        { cause: error }
      );
    }

    throw error;
  }
}

/* ============================================================
   HEALTH
   ============================================================ */

export const healthAPI = {
  /**
   * GET /api/v1/health/live
   */
  live: () =>
    request("GET", "/health/live"),

  /**
   * GET /api/v1/health/ready
   */
  ready: () =>
    request("GET", "/health/ready"),
};

/* ============================================================
   DASHBOARD
   ============================================================ */

export const dashboardAPI = {
  /**
   * GET /api/v1/dashboard/summary
   */
  summary: () =>
    request("GET", "/dashboard/summary"),
};

/* ============================================================
   AUTHORIZATIONS
   ============================================================ */

export const authorizationAPI = {
  /**
   * POST /api/v1/authorizations
   *
   * IMPORTANT:
   * Pass a JavaScript object here.
   * This client JSON.stringify()s it exactly once.
   */
  create: (payload, idempotencyKey = null) => {
    const headers = {};

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    return request("POST", "/authorizations", {
      body: payload,
      headers,
    });
  },

  /**
   * GET /api/v1/authorizations
   */
  list: (status = null, decision = null) => {
    const params = new URLSearchParams();

    if (status) {
      params.append("status", status);
    }

    if (decision) {
      params.append("decision", decision);
    }

    const query = params.toString();

    return request(
      "GET",
      `/authorizations${query ? `?${query}` : ""}`
    );
  },

  /**
   * GET /api/v1/authorizations/{request_id}
   */
  get: (requestId) =>
    request(
      "GET",
      `/authorizations/${requestId}`
    ),

  /**
   * POST /api/v1/authorizations/{request_id}/evaluate
   */
  evaluate: (
    requestId,
    policyId,
    version = null
  ) => {
    const params = new URLSearchParams();

    params.append("policy_id", policyId);

    if (version !== null && version !== undefined) {
      params.append("version", version);
    }

    return request(
      "POST",
      `/authorizations/${requestId}/evaluate?${params.toString()}`
    );
  },

  /**
   * GET /api/v1/authorizations/{request_id}/trace
   */
  trace: (requestId) =>
    request(
      "GET",
      `/authorizations/${requestId}/trace`
    ),

  /**
   * GET /api/v1/authorizations/{request_id}/explain
   */
  explain: (requestId) =>
    request(
      "GET",
      `/authorizations/${requestId}/explain`
    ),
};

/* ============================================================
   NURSE REVIEW
   ============================================================ */

export const reviewAPI = {
  /**
   * GET /api/v1/reviews/queue
   */
  queue: () =>
    request("GET", "/reviews/queue"),

  /**
   * GET /api/v1/reviews/requests/{request_id}
   */
  getByRequest: (requestId) =>
    request(
      "GET",
      `/reviews/requests/${requestId}`
    ),

  /**
   * GET /api/v1/reviews/{review_id}
   */
  get: (reviewId) =>
    request(
      "GET",
      `/reviews/${reviewId}`
    ),

  /**
   * POST /api/v1/reviews/requests/{request_id}
   *
   * Pass a normal JS object.
   */
  create: (requestId, payload = {}) =>
    request(
      "POST",
      `/reviews/requests/${requestId}`,
      {
        body: payload,
      }
    ),

  /**
   * POST /api/v1/reviews/{review_id}/complete
   */
  complete: (reviewId, payload = {}) =>
    request(
      "POST",
      `/reviews/${reviewId}/complete`,
      {
        body: payload,
      }
    ),
};

/* ============================================================
   POLICIES
   ============================================================ */

export const policyAPI = {
  /**
   * POST /api/v1/policies
   */
  create: (payload) =>
    request("POST", "/policies", {
      body: payload,
    }),

  /**
   * GET /api/v1/policies
   */
  list: () =>
    request("GET", "/policies"),

  /**
   * GET /api/v1/policies/{policy_id}
   */
  get: (policyId) =>
    request(
      "GET",
      `/policies/${policyId}`
    ),

  /**
   * GET /api/v1/policies/{policy_id}/versions
   */
  listVersions: (policyId) =>
    request(
      "GET",
      `/policies/${policyId}/versions`
    ),

  /**
   * GET /api/v1/policies/{policy_id}/versions/{version}
   */
  getVersion: (policyId, version) =>
    request(
      "GET",
      `/policies/${policyId}/versions/${version}`
    ),

  /**
   * GET /api/v1/policies/{policy_id}/active
   */
  getActiveVersion: (policyId) =>
    request(
      "GET",
      `/policies/${policyId}/active`
    ),

  /**
   * POST /api/v1/policies/{policy_id}/versions
   */
  createVersion: (policyId, payload) =>
    request(
      "POST",
      `/policies/${policyId}/versions`,
      {
        body: payload,
      }
    ),

  /**
   * POST /api/v1/policies/{policy_id}/versions/{version}/activate
   */
  activateVersion: (policyId, version) =>
    request(
      "POST",
      `/policies/${policyId}/versions/${version}/activate`
    ),
};

/* ============================================================
   EXTRACTION
   ============================================================ */

export const extractionAPI = {
  /**
   * POST /api/v1/extraction/extract
   */
  extract: (payload) =>
    request(
      "POST",
      "/extraction/extract",
      {
        body: payload,
      }
    ),

  /**
   * POST /api/v1/extraction/preview
   */
  preview: (payload) =>
    request(
      "POST",
      "/extraction/preview",
      {
        body: payload,
      }
    ),
};

/* ============================================================
   RAG
   ============================================================ */

export const ragAPI = {
  /**
   * GET /api/v1/rag/health
   */
  health: () =>
    request("GET", "/rag/health"),

  /**
   * POST /api/v1/rag/retrieve
   */
  retrieve: (payload) =>
    request(
      "POST",
      "/rag/retrieve",
      {
        body: payload,
      }
    ),

  /**
   * POST /api/v1/rag/evaluate
   */
  evaluate: (payload) =>
    request(
      "POST",
      "/rag/evaluate",
      {
        body: payload,
      }
    ),
};

/* ============================================================
   AUDIT
   ============================================================ */

export const auditAPI = {
  /**
   * GET /api/v1/audit/{request_id}
   */
  trail: (requestId) =>
    request(
      "GET",
      `/audit/${requestId}`
    ),
};

/* ============================================================
   DEFAULT API OBJECT
   ============================================================ */

const api = {
  health: healthAPI,
  dashboard: dashboardAPI,
  authorization: authorizationAPI,
  review: reviewAPI,
  policy: policyAPI,
  extraction: extractionAPI,
  rag: ragAPI,
  audit: auditAPI,
};

export default api;
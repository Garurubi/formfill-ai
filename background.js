const GEMINI_API_KEY = "AIzaSyCx2NEUWzWhJ5EXOefePDEW8bLnG8IHzhs";
const DEFAULT_MODEL = "gemini-3-flash-preview";
const MIN_CAPTURE_INTERVAL_MS = 1200;

let captureQueue = Promise.resolve();
let lastCaptureAt = 0;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureVisibleTab") {
    captureQueue = captureQueue
      .catch(() => undefined)
      .then(() => captureVisibleTabWithThrottle(sender.tab?.windowId));

    captureQueue
      .then((dataUrl) => {
        sendResponse({ success: true, dataUrl });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          message: error.message || "화면 캡처에 실패했습니다.",
        });
      });

    return true;
  }

  if (request.action === "generateGeminiPlan") {
    generateGeminiPlan(request.payload)
      .then((plan) => {
        sendResponse({ success: true, plan });
      })
      .catch((error) => {
        console.error("FormFill AI: Gemini 호출 실패", error);
        sendResponse({
          success: false,
          message: error.message || "Gemini 계획 생성에 실패했습니다.",
        });
      });

    return true;
  }

  sendResponse({ success: false, message: "Unknown action" });
  return true;
});

async function captureVisibleTabWithThrottle(windowId) {
  const elapsed = Date.now() - lastCaptureAt;
  if (elapsed < MIN_CAPTURE_INTERVAL_MS) {
    await wait(MIN_CAPTURE_INTERVAL_MS - elapsed);
  }

  const dataUrl = await captureVisibleTab(windowId);
  lastCaptureAt = Date.now();
  return dataUrl;
}

function captureVisibleTab(windowId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      windowId,
      { format: "png" },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(dataUrl);
      },
    );
  });
}

async function generateGeminiPlan(payload = {}) {
  const model = payload.model || DEFAULT_MODEL;
  const prompt = String(payload.prompt || "").trim();
  const screenshots = Array.isArray(payload.screenshots) ? payload.screenshots : [];

  if (!prompt) {
    throw new Error("Gemini 프롬프트가 비어 있습니다.");
  }

  const parts = [
    ...screenshots.map((screenshot) => ({
      inlineData: {
        mimeType: "image/png",
        data: String(screenshot.dataUrl || "").split(",")[1] || "",
      },
    })),
    { text: prompt },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 오류 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = extractResponseText(data);

  if (!text) {
    throw new Error("Gemini 응답 텍스트가 비어 있습니다.");
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("FormFill AI: Gemini 원본 응답", text);
    throw new Error("Gemini 응답 JSON 파싱에 실패했습니다.");
  }
}

function extractResponseText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => part?.text || "")
    .join("")
    .trim();
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

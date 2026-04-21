const openInfoButton = document.getElementById("openInfoBtn");
const openFillButton = document.getElementById("openFillBtn");
const statusElement = document.getElementById("status");
const SIDE_PANEL_STATE_KEY = "sidePanelLaunchState";

function setStatus(message, type = "") {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`.trim();
}

async function openSidePanel(mode, autoFill = false) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("현재 활성 탭을 찾을 수 없습니다.");
  }

  await chrome.storage.local.set({
    [SIDE_PANEL_STATE_KEY]: {
      mode: mode === "info" ? "info" : "fill",
      autoFill: Boolean(autoFill),
      requestedAt: Date.now(),
      tabId: tab.id,
    },
  });

  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "sidepanel.html",
    enabled: true,
  });

  await chrome.sidePanel.open({
    tabId: tab.id,
  });
}

openInfoButton.addEventListener("click", async () => {
  try {
    await openSidePanel("info", false);
    setStatus("오른쪽 패널에서 이력 정보를 입력할 수 있습니다.", "success");
    window.close();
  } catch (error) {
    console.error("FormFill AI: 정보입력 패널 열기 실패", error);
    setStatus("정보 입력 패널을 열지 못했습니다." + error.message, "error");
  }
});

openFillButton.addEventListener("click", async () => {
  try {
    await openSidePanel("fill", true);
    setStatus("오른쪽 패널을 열고 현재 페이지 자동 입력을 준비했습니다.", "success");
    window.close();
  } catch (error) {
    console.error("FormFill AI: 자동 입력 패널 열기 실패", error);
    setStatus("자동 입력 패널을 열지 못했습니다.", "error");
  }
});

const STORAGE_KEY = "resumeData";

const form = document.getElementById("resumeForm");
const saveButton = document.getElementById("saveBtn");
const fillButton = document.getElementById("fillBtn");
const statusElement = document.getElementById("status");

function setStatus(message, type = "") {
    statusElement.textContent = message;
    statusElement.className = `status ${type}`.trim();
}

function getResumeDataFromForm() {
    const resumeData = {};

    Array.from(form.elements).forEach(element => {
        if (!element.name) {
            return;
        }

        if (element.type === "radio") {
            if (element.checked) {
                resumeData[element.name] = element.value;
            } else if (!Object.prototype.hasOwnProperty.call(resumeData, element.name)) {
                resumeData[element.name] = "";
            }
            return;
        }

        if (element.type === "checkbox") {
            resumeData[element.name] = element.checked;
            return;
        }

        resumeData[element.name] = String(element.value || "").trim();
    });

    return resumeData;
}

function populateForm(resumeData = {}) {
    Array.from(form.elements).forEach(element => {
        if (!element.name) {
            return;
        }

        if (element.type === "radio") {
            element.checked = String(resumeData[element.name] || "") === String(element.value);
            return;
        }

        if (element.type === "checkbox") {
            element.checked = Boolean(resumeData[element.name]);
            return;
        }

        element.value = resumeData[element.name] || "";
    });
}

async function loadStoredResumeData() {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    populateForm(result[STORAGE_KEY]);
}

async function saveResumeData() {
    const resumeData = getResumeDataFromForm();
    await chrome.storage.local.set({ [STORAGE_KEY]: resumeData });
    setStatus("이력서 정보를 저장했습니다.", "success");
    return resumeData;
}

async function fillCurrentTab() {
    const resumeData = getResumeDataFromForm();

    if (!Object.values(resumeData).some(value => value === true || Boolean(value))) {
        setStatus("먼저 이력서 정보를 입력해 주세요.", "error");
        return;
    }

    await chrome.storage.local.set({ [STORAGE_KEY]: resumeData });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        setStatus("현재 탭을 찾을 수 없습니다.", "error");
        return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
        action: "fill",
        data: resumeData
    });

    if (response?.status === "success") {
        setStatus("현재 페이지에 이력서 정보를 입력했습니다.", "success");
        return;
    }

    setStatus(response?.message || "페이지 입력에 실패했습니다.", "error");
}

saveButton.addEventListener("click", async () => {
    try {
        await saveResumeData();
    } catch (error) {
        console.error("FormFill AI: 저장 실패", error);
        setStatus("이력서 정보를 저장하지 못했습니다.", "error");
    }
});

fillButton.addEventListener("click", async () => {
    try {
        await fillCurrentTab();
    } catch (error) {
        console.error("FormFill AI: 자동 입력 실패", error);
        setStatus("현재 페이지에 입력하지 못했습니다.", "error");
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await loadStoredResumeData();
    } catch (error) {
        console.error("FormFill AI: 저장 데이터 로드 실패", error);
        setStatus("저장된 이력서 정보를 불러오지 못했습니다.", "error");
    }
});

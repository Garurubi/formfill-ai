const RESUME_STORAGE_KEY = "resumeData";
const GEMINI_API_KEY_STORAGE_KEY = "geminiApiKey";
const SIDE_PANEL_STATE_KEY = "sidePanelLaunchState";
const APPLY_TEST_DEFAULTS_ON_LOAD = true;
const TEST_GEMINI_API_KEY = "";
const TEST_RESUME_DATA = {
  name: "정재희",
  birthDate: "1992-10-20",
  gender: "남",
  email: "jjhee3156@gmail.com",
  phone: "010-4455-3156",
  hanjaName: "鄭在熙",
  englishName: "JEONG JAEHEE",
  emergencyContact: "010-5426-3156",
  emergencyRelation: "부",
  experienceLevel: "경력",
  department: "AI 엔지니어",
  desiredSalary: "4500",
  desiredSalaryNegotiable: true,
  currentSalary: "3900",
  availableDate: "2026-05-01",
  nationality: "대한민국",
  zipCode: "13120",
  address: "경기도 성남시 수정구",
  addressDetail: "가천대학교 AI관",
  militaryStatus: "군필",
  militaryRank: "병장",
  militaryStartDate: "2013-01-10",
  militaryEndDate: "2014-10-09",
  dischargeType: "만기제대",
  highSchoolStartDate: "2008-03-02",
  highSchoolEndDate: "2011-02-10",
  highSchoolName: "가천고등학교",
  highSchoolLocation: "경기",
  highSchoolGraduationStatus: "졸업",
  highSchoolTrack: "인문",
  collegeStartDate: "2011-03-02",
  collegeEndDate: "2018-02-20",
  collegeName: "가천대학교",
  collegeLocation: "경기",
  collegeGraduationStatus: "졸업",
  collegeCampusType: "본교",
  majorName: "기계공학",
  minorName: "",
  gpa: "3.8",
  gpaScale: "4.5",
  degreeType: "학사",
  attendanceType: "주간",
  certificates: [
    {
      name: "정보처리기사",
      issuer: "한국산업인력공단",
      date: "2020-09-11",
      number: "20-0-123456",
    },
    {
      name: "SQLD",
      issuer: "한국데이터산업진흥원",
      date: "2021-04-16",
      number: "SQLD-21-654321",
    },
  ],
  employmentType: "정규직",
  companyName: "폼필 AI",
  careerStartDate: "2022-01-03",
  careerEndDate: "",
  isCurrentEmployment: true,
  jobTitle: "AI 엔지니어",
  retirementReason: "",
  departmentName: "AI 개발팀",
  jobDescription: "LLM 기반 자동화 서비스 개발 및 운영",
  education: "가천대학교 기계공학과",
  experience: "AI 엔지니어 4년",
};

const form = document.getElementById("resumeForm");
const apiKeyInput = document.getElementById("geminiApiKey");
const loadTestDataButton = document.getElementById("loadTestDataBtn");
const clearButton = document.getElementById("clearBtn");
const saveButton = document.getElementById("saveBtn");
const fillBottomButton = document.getElementById("fillBottomBtn");
const statusElement = document.getElementById("status");
const isCurrentEmploymentInput = document.getElementById("isCurrentEmployment");
const careerEndDateInput = document.getElementById("careerEndDate");
const accordionTriggers = Array.from(document.querySelectorAll("[data-accordion-trigger]"));
const certificatesContainer = document.getElementById("certificatesContainer");
const addCertificateButton = document.getElementById("addCertificateBtn");

let lastHandledRequestedAt = 0;

function createEmptyCertificate() {
  return {
    name: "",
    issuer: "",
    date: "",
    number: "",
  };
}

function escapeAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeCertificates(certificates = []) {
  return certificates
    .map((certificate) => ({
      name: String(certificate?.name || "").trim(),
      issuer: String(certificate?.issuer || "").trim(),
      date: String(certificate?.date || "").trim(),
      number: String(certificate?.number || "").trim(),
    }))
    .filter((certificate) => Object.values(certificate).some(Boolean));
}

function getCertificatesFromResumeData(resumeData = {}) {
  if (Array.isArray(resumeData.certificates)) {
    return sanitizeCertificates(resumeData.certificates);
  }

  return sanitizeCertificates([
    {
      name: resumeData.certificateName,
      issuer: resumeData.certificateIssuer,
      date: resumeData.certificateDate,
      number: resumeData.certificateNumber,
    },
  ]);
}

function getCertificateEntriesFromForm() {
  if (!certificatesContainer) {
    return [];
  }

  return Array.from(certificatesContainer.querySelectorAll("[data-certificate-item]")).map((item) => ({
    name: String(item.querySelector("[data-field='name']")?.value || "").trim(),
    issuer: String(item.querySelector("[data-field='issuer']")?.value || "").trim(),
    date: String(item.querySelector("[data-field='date']")?.value || "").trim(),
    number: String(item.querySelector("[data-field='number']")?.value || "").trim(),
  }));
}

function buildCertificateCard(index, certificate = createEmptyCertificate()) {
  const wrapper = document.createElement("section");
  wrapper.className = "subcard certificate-card";
  wrapper.dataset.certificateItem = "true";
  wrapper.innerHTML = `
    <div class="section-toolbar">
      <h3 class="subcard-title">자격증 ${index + 1}</h3>
      <button type="button" class="remove-inline-button" data-remove-certificate>삭제</button>
    </div>

    <div class="inline-grid">
      <div class="field">
        <label>자격증명</label>
        <input type="text" data-field="name" placeholder="정보처리기사" value="${escapeAttribute(certificate.name)}">
      </div>

      <div class="field">
        <label>발급기관</label>
        <input type="text" data-field="issuer" placeholder="한국산업인력공단" value="${escapeAttribute(certificate.issuer)}">
      </div>
    </div>

    <div class="inline-grid">
      <div class="field">
        <label>취득일</label>
        <input type="date" data-field="date" value="${escapeAttribute(certificate.date)}">
      </div>

      <div class="field">
        <label>등록번호</label>
        <input type="text" data-field="number" placeholder="1234-567890" value="${escapeAttribute(certificate.number)}">
      </div>
    </div>
  `;

  const removeButton = wrapper.querySelector("[data-remove-certificate]");
  removeButton?.addEventListener("click", () => {
    const entries = getCertificateEntriesFromForm();
    entries.splice(index, 1);
    renderCertificates(entries);
  });

  return wrapper;
}

function renderCertificates(certificates = [createEmptyCertificate()]) {
  if (!certificatesContainer) {
    return;
  }

  const normalizedCertificates = certificates.length > 0
    ? certificates.map((certificate) => ({
      ...createEmptyCertificate(),
      ...certificate,
    }))
    : [createEmptyCertificate()];

  certificatesContainer.replaceChildren(
    ...normalizedCertificates.map((certificate, index) => buildCertificateCard(index, certificate)),
  );
}

function setStatus(message, type = "") {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`.trim();
}

function hasMeaningfulValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulValue(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => hasMeaningfulValue(item));
  }

  return Boolean(String(value || "").trim());
}

function cloneTestResumeData() {
  const certificates = sanitizeCertificates(TEST_RESUME_DATA.certificates);
  const firstCertificate = certificates[0] || createEmptyCertificate();

  return {
    ...TEST_RESUME_DATA,
    certificates,
    certificateName: firstCertificate.name,
    certificateIssuer: firstCertificate.issuer,
    certificateDate: firstCertificate.date,
    certificateNumber: firstCertificate.number,
  };
}

function getResumeDataFromForm() {
  const resumeData = {};

  Array.from(form.elements).forEach((element) => {
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

  const certificates = sanitizeCertificates(getCertificateEntriesFromForm());
  const firstCertificate = certificates[0] || createEmptyCertificate();
  resumeData.certificates = certificates;
  resumeData.certificateName = firstCertificate.name;
  resumeData.certificateIssuer = firstCertificate.issuer;
  resumeData.certificateDate = firstCertificate.date;
  resumeData.certificateNumber = firstCertificate.number;

  return resumeData;
}

function populateForm(resumeData = {}) {
  Array.from(form.elements).forEach((element) => {
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

  const certificates = getCertificatesFromResumeData(resumeData);
  renderCertificates(certificates.length > 0 ? certificates : [createEmptyCertificate()]);

  syncCareerFields();
}

function populateTestData() {
  populateForm(cloneTestResumeData());
  apiKeyInput.value = TEST_GEMINI_API_KEY;
}

function syncCareerFields() {
  const isCurrentEmployment = Boolean(isCurrentEmploymentInput?.checked);
  if (!careerEndDateInput) {
    return;
  }

  careerEndDateInput.disabled = isCurrentEmployment;

  if (isCurrentEmployment) {
    careerEndDateInput.value = "";
  }
}

function toggleAccordion(trigger) {
  const accordion = trigger.closest("[data-accordion]");
  if (!accordion) {
    return;
  }

  const isOpen = accordion.classList.toggle("open");
  trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

async function clearFormAndStorage() {
  form.reset();
  populateForm({});
  apiKeyInput.value = "";

  await chrome.storage.local.remove([RESUME_STORAGE_KEY, GEMINI_API_KEY_STORAGE_KEY]);
  setStatus("입력값과 저장된 데이터를 모두 비웠습니다.", "success");
}

async function loadStoredResumeData() {
  const result = await chrome.storage.local.get([RESUME_STORAGE_KEY, GEMINI_API_KEY_STORAGE_KEY]);
  const storedResumeData = result[RESUME_STORAGE_KEY];
  const storedApiKey = result[GEMINI_API_KEY_STORAGE_KEY] || "";

  if (storedResumeData && Object.keys(storedResumeData).length > 0) {
    populateForm(storedResumeData);
    apiKeyInput.value = storedApiKey;
    return;
  }

  if (APPLY_TEST_DEFAULTS_ON_LOAD) {
    populateTestData();
    setStatus("테스트 기본값을 불러왔습니다. 필요하면 수정 후 저장해 주세요.");
    return;
  }

  populateForm({});
  apiKeyInput.value = storedApiKey;
}

async function saveResumeData() {
  const resumeData = getResumeDataFromForm();
  const geminiApiKey = String(apiKeyInput.value || "").trim();

  await chrome.storage.local.set({
    [RESUME_STORAGE_KEY]: resumeData,
    [GEMINI_API_KEY_STORAGE_KEY]: geminiApiKey,
  });

  setStatus("이력서 정보와 Gemini API 키를 저장했습니다.", "success");
  return {
    resumeData,
    geminiApiKey,
  };
}

async function fillCurrentTab() {
  const resumeData = getResumeDataFromForm();
  const geminiApiKey = String(apiKeyInput.value || "").trim();

  if (!Object.values(resumeData).some((value) => hasMeaningfulValue(value))) {
    setStatus("먼저 이력서 정보를 입력해 주세요.", "error");
    return false;
  }

  if (!geminiApiKey) {
    setStatus("Gemini API 키를 먼저 입력해 주세요.", "error");
    return false;
  }

  await chrome.storage.local.set({
    [RESUME_STORAGE_KEY]: resumeData,
    [GEMINI_API_KEY_STORAGE_KEY]: geminiApiKey,
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("현재 탭을 찾을 수 없습니다.", "error");
    return false;
  }

  setStatus("현재 페이지를 분석하고 입력을 시작합니다.");

  const response = await chrome.tabs.sendMessage(tab.id, {
    action: "fill",
    data: resumeData,
  });

  if (response?.status !== "success") {
    setStatus(response?.message || "페이지 입력에 실패했습니다.", "error");
    return false;
  }

  const dynamicResponse = await chrome.tabs.sendMessage(tab.id, {
    action: "fillDynamic",
    data: resumeData,
  });

  if (dynamicResponse?.status === "success") {
    setStatus("현재 페이지에 이력서 정보 입력과 동적 실행을 완료했습니다.", "success");
    return true;
  }

  setStatus(dynamicResponse?.message || "기본 입력 후 동적 실행에 실패했습니다.", "error");
  return false;
}

async function consumeLaunchState(state) {
  await chrome.storage.local.set({
    [SIDE_PANEL_STATE_KEY]: {
      ...state,
      autoFill: false,
    },
  });
}

async function applyLaunchState(state) {
  if (!state || !state.requestedAt || state.requestedAt <= lastHandledRequestedAt) {
    return;
  }

  lastHandledRequestedAt = state.requestedAt;

  if (!state.autoFill) {
    return;
  }

  await consumeLaunchState(state);

  window.setTimeout(async () => {
    try {
      await fillCurrentTab();
    } catch (error) {
      console.error("FormFill AI: 자동 입력 실행 실패", error);
      setStatus("현재 페이지 자동 입력을 실행하지 못했습니다.", "error");
    }
  }, 150);
}

addCertificateButton?.addEventListener("click", () => {
  const entries = getCertificateEntriesFromForm();
  entries.push(createEmptyCertificate());
  renderCertificates(entries);
});

loadTestDataButton.addEventListener("click", () => {
  populateTestData();
  setStatus("테스트 기본값을 폼에 채웠습니다.");
});

clearButton.addEventListener("click", async () => {
  try {
    await clearFormAndStorage();
  } catch (error) {
    console.error("FormFill AI: 초기화 실패", error);
    setStatus("입력값을 비우지 못했습니다.", "error");
  }
});

isCurrentEmploymentInput?.addEventListener("change", () => {
  syncCareerFields();
});

saveButton.addEventListener("click", async () => {
  try {
    await saveResumeData();
  } catch (error) {
    console.error("FormFill AI: 저장 실패", error);
    setStatus("이력서 정보를 저장하지 못했습니다.", "error");
  }
});

fillBottomButton.addEventListener("click", async () => {
  try {
    await fillCurrentTab();
  } catch (error) {
    console.error("FormFill AI: 자동 입력 실패", error);
    setStatus("현재 페이지에 입력하지 못했습니다.", "error");
  }
});

accordionTriggers.forEach((trigger) => {
  trigger.addEventListener("click", () => {
    toggleAccordion(trigger);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[SIDE_PANEL_STATE_KEY]?.newValue) {
    return;
  }

  applyLaunchState(changes[SIDE_PANEL_STATE_KEY].newValue).catch((error) => {
    console.error("FormFill AI: 사이드 패널 상태 반영 실패", error);
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    renderCertificates([createEmptyCertificate()]);
    await loadStoredResumeData();

    const result = await chrome.storage.local.get([SIDE_PANEL_STATE_KEY]);
    await applyLaunchState(result[SIDE_PANEL_STATE_KEY]);
  } catch (error) {
    console.error("FormFill AI: 사이드 패널 초기화 실패", error);
    setStatus("사이드 패널 초기화에 실패했습니다.", "error");
  }
});

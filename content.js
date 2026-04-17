const GEMINI_MODEL = "gemini-3-flash-preview";
const SCREENSHOT_DELAY_MS = 350;

class FormAnalyzer {
  constructor() {
    this.inputs = [];
    this.inputMap = new Map();
  }

  analyzeInputs() {
    this.inputs = [];
    this.inputMap.clear();

    const elements = Array.from(document.querySelectorAll("input, select, textarea"));
    let index = 0;

    elements.forEach((element) => {
      if (!this.isFillableElement(element)) {
        return;
      }

      const domKey = this.buildDomKey(element, index);
      const inputData = {
        domKey,
        element,
        tagName: element.tagName.toLowerCase(),
        type: (element.type || "").toLowerCase(),
        id: element.id || "",
        name: element.name || "",
        placeholder: element.placeholder || "",
        label: this.findLabelFor(element),
        ariaLabel: element.getAttribute("aria-label") || "",
        required: Boolean(element.required),
        selector: this.buildSelector(element),
        sectionText: this.getSectionText(element),
        optionTexts: this.getOptionTexts(element),
      };

      this.inputs.push(inputData);
      this.inputMap.set(domKey, inputData);
      index += 1;
    });

    console.log("FormFill AI: 폼 필드 분석 완료", this.inputs.length);
    return this.inputs;
  }

  /**
   * 태그별로 중복되지 않게 식별하는 키를 생성합니다.
   * @param {*} element 
   * @param {*} index 
   * @returns 
   */
  buildDomKey(element, index) {
    const seed = element.id || element.name || `${element.tagName.toLowerCase()}_${element.type || "field"}`;
    const sanitized = seed.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    return `field_${String(index).padStart(3, "0")}_${sanitized || "input"}`;
  }

  /**
   * 
   * @param {*} element 
   * @returns 
   */
  buildSelector(element) {
    if (element.id) {
      return `#${this.escapeSelector(element.id)}`;
    }

    const segments = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && segments.length < 4) {
      let segment = current.tagName.toLowerCase();
      if (current.name) {
        segment += `[name="${current.name.replace(/"/g, '\\"')}"]`;
        segments.unshift(segment);
        break;
      }

      const siblings = current.parentElement
        ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName)
        : [];

      if (siblings.length > 1) {
        segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }

      segments.unshift(segment);
      current = current.parentElement;
    }

    return segments.join(" > ");
  }

  /**
   * CSS.escape가 지원되지 않는 환경을 위해 간단한 이스케이프 함수를 제공합니다.
   * @param {*} value 
   * @returns 
   */
  escapeSelector(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1");
  }

  /**
   * input 요소에 대응하는 label을 찾아 text를 반환
   * @param {HTMLInputElement} input 
   * @returns 
   */
  findLabelFor(input) {
    // <input id> = <label for>인 경우 label의 텍스트를 사용
    if (input.id) {
      const label = document.querySelector(`label[for="${this.escapeSelector(input.id)}"]`);
      if (label?.innerText?.trim()) {
        return label.innerText.trim();
      }
    }

    // aria-label이 있는 경우 연결된 label 태그를 모두 찾아 text를 합쳐서 반환
    const ariaLabelledBy = input.getAttribute("aria-labelledby");
    if (ariaLabelledBy) {
      const labelFromAria = ariaLabelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((node) => node.innerText.trim())
        .filter(Boolean)
        .join(" ");

      if (labelFromAria) {
        return labelFromAria;
      }
    }

    // 부모방향으로 가장 가까운 label을 찾음
    const parentLabel = input.closest("label");
    if (parentLabel?.innerText?.trim()) {
      return parentLabel.innerText.trim();
    }

    return "";
  }

  getSectionText(element) {
    const container =
      element.closest("fieldset, section, article, li, tr, .field, .form-group, .input-wrap, .row") ||
      element.parentElement;

    if (!container) {
      return "";
    }

    const text = (container.innerText || container.textContent || "")
      .replace(/\s+/g, " ")
      .trim();

    return text.slice(0, 240);
  }

  getOptionTexts(element) {
    if (element.tagName === "SELECT") {
      return Array.from(element.options || [])
        .map((option) => ({
          value: option.value,
          text: (option.textContent || "").trim(),
        }))
        .filter((option) => option.value || option.text);
    }

    if ((element.type || "").toLowerCase() === "radio" || (element.type || "").toLowerCase() === "checkbox") {
      const labelText = this.findLabelFor(element);
      return labelText ? [{ value: element.value || "", text: labelText }] : [];
    }

    return [];
  }

  /**
   * 주어진 요소가 입력 가능한 요소인지 확인합니다.
   * - input 요소는 type이 hidden, submit, button, reset, image, file이 아니어야 합니다.
   * - select와 textarea 요소는 모두 입력 가능 요소로 간주합니다.
   * @param {*} element 
   * @returns {boolean}
   */
  isFillableElement(element) {
    if (!element || element.disabled || element.readOnly) {
      return false;
    }

    if (element.tagName === "INPUT") {
      const type = (element.type || "").toLowerCase();
      const excluded = new Set(["hidden", "submit", "button", "reset", "image", "file"]);
      return !excluded.has(type);
    }

    return element.tagName === "SELECT" || element.tagName === "TEXTAREA";
  }

  async capturePageScreenshots() {
    const scrollElement = document.scrollingElement || document.documentElement;
    const originalX = window.scrollX;
    const originalY = window.scrollY;
    const viewportHeight = Math.max(window.innerHeight || 0, 1);
    const totalHeight = Math.max(
      scrollElement.scrollHeight || 0,
      document.documentElement.scrollHeight || 0,
      document.body?.scrollHeight || 0,
      viewportHeight,
    );
    const positions = [];

    for (let y = 0; y < totalHeight; y += viewportHeight) {
      positions.push(y);
    }

    const lastPosition = Math.max(totalHeight - viewportHeight, 0);
    if (!positions.includes(lastPosition)) {
      positions.push(lastPosition);
    }

    const screenshots = [];

    try {
      for (let index = 0; index < positions.length; index += 1) {
        const y = positions[index];
        window.scrollTo(0, y);
        await this.wait(SCREENSHOT_DELAY_MS);

        const response = await this.sendRuntimeMessage({
          action: "captureVisibleTab",
        });

        if (!response?.success || !response.dataUrl) {
          throw new Error(response?.message || "화면 캡처에 실패했습니다.");
        }

        screenshots.push({
          fileName: `capture_${String(index + 1).padStart(2, "0")}.png`,
          dataUrl: response.dataUrl,
        });
      }
    } finally {
      window.scrollTo(originalX, originalY);
      await this.wait(100);
    }

    return screenshots;
  }

  buildGeminiPrompt(screenshots, inputs, resumeData) {
    const imageNames = screenshots.map((screenshot) => screenshot.fileName);
    const compactResumeData = Object.fromEntries(
      Object.entries(resumeData || {}).filter(([, value]) => {
        if (typeof value === "boolean") {
          return value;
        }

        return String(value || "").trim() !== "";
      }),
    );

    const serializedInputs = inputs.map((input) => ({
      domKey: input.domKey,
      tagName: input.tagName,
      type: input.type,
      id: input.id,
      name: input.name,
      placeholder: input.placeholder,
      label: input.label,
      ariaLabel: input.ariaLabel,
      required: input.required,
      selector: input.selector,
      sectionText: input.sectionText,
      optionTexts: input.optionTexts,
    }));

    return `
당신은 채용 사이트 지원서를 분석해서 자동 입력 계획을 세우는 도우미입니다.

첨부된 PNG들은 하나의 지원서 페이지를 위에서 아래로 캡처한 화면들입니다.
추가로 현재 페이지 DOM에서 추출한 입력 태그 메타데이터와, 사용자가 미리 저장한 이력서 데이터가 제공됩니다.

해야 할 일:
1. 이미지와 DOM 정보를 함께 보고 각 태그가 어떤 정보를 입력받는지 추론합니다.
2. 제공된 resumeData만 사용해서 각 태그에 실제로 넣을 값을 결정합니다.
3. 반환은 순수 JSON만 합니다. 마크다운 코드블록은 금지합니다.
4. domKey는 반드시 제공된 목록 중 하나를 그대로 사용합니다.
5. 값을 결정할 수 없는 항목은 action="skip", value="" 로 반환합니다.
6. 라디오/체크박스/셀렉트는 실제 선택해야 할 값이나 표시 텍스트를 value에 넣습니다.

스크린샷 파일 목록:
${imageNames.map((name, index) => `${index + 1}. ${name}`).join("\n")}

resumeData:
${JSON.stringify(compactResumeData, null, 2)}

DOM 입력 태그 목록:
${JSON.stringify(serializedInputs, null, 2)}

반환 형식:
{
  "summary": "이 페이지에서 입력해야 하는 정보에 대한 한두 문장 요약",
  "fields": [
    {
      "domKey": "제공된 domKey 중 하나",
      "fieldLabel": "화면에 보이는 라벨/placeholder/항목명",
      "resumeKey": "name | birthDate | email | phone | address | education | experience | military | gender | portfolio | selfIntroduction | desiredSalary | hanjaName | englishName | emergencyContact | emergencyRelation | experienceLevel | department | desiredSalaryNegotiable | currentSalary | availableDate | etc",
      "inputType": "text | textarea | number | date | email | tel | checkbox | radio | select | unknown",
      "inputPlan": "실제로 어떤 형식으로 입력하면 되는지 설명",
      "exampleValue": "예시 값",
      "value": "실제로 넣을 값",
      "required": true,
      "guessed": false,
      "action": "type | click | select | check | skip",
      "why": "이렇게 판단한 근거",
      "sourceImages": ["파일명1.png", "파일명2.png"]
    }
  ]
}

판단 규칙:
- 보이는 텍스트, placeholder, 섹션 제목, 버튼 문구, DOM label/sectionText를 최대한 활용하세요.
- resumeData에 없는 값을 새로 지어내지 마세요.
- 한 라디오 그룹의 여러 항목 중 선택할 항목만 반환하고, 선택하지 않을 항목은 skip 처리해도 됩니다.
- 동일 resumeKey가 여러 태그로 분리돼 있더라도 이미지/DOM상 같은 값이 반복 입력되어야 하면 각각 반환할 수 있습니다.
- 화면상 확실하지 않으면 guessed=true 를 사용하고 why에 이유를 적으세요.
`.trim();
  }

  async generatePlan(resumeData) {
    const inputs = this.analyzeInputs();
    const screenshots = await this.capturePageScreenshots();
    const prompt = this.buildGeminiPrompt(screenshots, inputs, resumeData);

    const response = await this.sendRuntimeMessage({
      action: "generateGeminiPlan",
      payload: {
        model: GEMINI_MODEL,
        prompt,
        screenshots,
      },
    });

    if (!response?.success || !response.plan) {
      throw new Error(response?.message || "Gemini 계획 생성에 실패했습니다.");
    }

    return response.plan;
  }

  async fillForm(resumeData) {
    const plan = await this.generatePlan(resumeData);
    this.analyzeInputs();

    const applied = [];

    for (const field of plan.fields || []) {
      const inputData = this.inputMap.get(field.domKey);
      // !@#$ llm이 donKey를 잘못 입력하면 수행하지 못함
      if (!inputData) {
        continue;
      }

      const resolvedValue = this.resolvePlanValue(field, resumeData);
      const didApply = await this.applyPlannedValue(inputData.element, resolvedValue, field);

      if (didApply) {
        applied.push({
          domKey: field.domKey,
          fieldLabel: field.fieldLabel || inputData.label || inputData.name || inputData.id,
          value: resolvedValue,
        });
      }
    }

    console.log("FormFill AI: 자동 완성 완료", applied.length);

    return {
      summary: plan.summary || "",
      appliedCount: applied.length,
      applied,
      plan,
    };
  }

  /**
   * LLM이 생성한 값을 우선하고, 값이 없으면 resumeData에서 가져옴.
   * @param {Object} field 
   * @param {Object} resumeData 
   * @returns String
   */
  resolvePlanValue(field, resumeData) {
    const directValue = field?.value;
    if (directValue !== undefined && directValue !== null && String(directValue) !== "") {
      return directValue;
    }

    if (field?.resumeKey && Object.prototype.hasOwnProperty.call(resumeData, field.resumeKey)) {
      return resumeData[field.resumeKey];
    }

    return "";
  }

  /**
   * tagname과 type에 따라 값을 입력함(성공, 실패 여부 반환)
   * @param {Element} element 
   * @param {String} value 
   * @param {Object} field 
   * @returns boolean
   */
  async applyPlannedValue(element, value, field) {
    const action = String(field?.action || "").toLowerCase();
    if (!element || action === "skip") {
      return false;
    }

    const tagName = element.tagName.toLowerCase();
    const type = (element.type || "").toLowerCase();

    element.scrollIntoView({ block: "center", inline: "nearest" });
    await this.wait(60);

    if (tagName === "select") {
      return this.applySelectValue(element, value);
    }

    if (type === "checkbox") {
      return this.applyCheckboxValue(element, value);
    }

    if (type === "radio") {
      return this.applyRadioValue(element, value);
    }

    return this.applyTextValue(element, value);
  }

  applyTextValue(element, value) {
    const normalizedValue = this.normalizeValueForElement(element, value);
    const nextValue = normalizedValue == null ? "" : String(normalizedValue);

    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }

    this.setNativeValue(element, nextValue);
    this.dispatchTextEvents(element, nextValue);
    element.blur();
    return true;
  }

  applyCheckboxValue(element, value) {
    const desired = this.toBoolean(value);
    if (element.checked === desired) {
      return false;
    }

    if (this.isClickable(element)) {
      element.click();
    } else {
      this.setNativeChecked(element, desired);
      this.dispatchChangeEvents(element);
    }

    return true;
  }

  applyRadioValue(element, value) {
    if (!this.shouldSelectRadio(element, value)) {
      return false;
    }

    if (element.checked) {
      return false;
    }

    if (this.isClickable(element)) {
      element.click();
    } else {
      this.setNativeChecked(element, true);
      this.dispatchChangeEvents(element);
    }

    return true;
  }

  /**
   * element가 value와 일치하는지 확인해 적절한 radio 버튼인지 판단
   * @param {Element} element 
   * @param {String} value 
   * @returns 
   */
  shouldSelectRadio(element, value) {
    if (typeof value === "boolean") {
      return value;
    }

    // 값이 없으면 실패
    const normalizedValue = this.normalizeText(value);
    if (!normalizedValue) {
      return false;
    }

    const candidates = [
      element.value,
      this.findLabelFor(element),
      element.getAttribute("aria-label"),
      element.name,
    ]
      .map((item) => this.normalizeText(item))
      .filter(Boolean);

    // !@#$ 후보 텍스트값이 value와 완전히 일치하거나 포함하는 경우 선택
    return candidates.some((candidate) => candidate === normalizedValue || candidate.includes(normalizedValue));
  }

  applySelectValue(element, value) {
    const target = this.normalizeText(value);
    const options = Array.from(element.options || []);
    const matchedOption =
      options.find(
        (option) =>
          this.normalizeText(option.value) === target ||
          this.normalizeText(option.textContent) === target,
      ) ||
      options.find(
        (option) =>
          this.normalizeText(option.value).includes(target) ||
          this.normalizeText(option.textContent).includes(target),
      );

    if (!matchedOption) {
      return false;
    }

    if (element.value === matchedOption.value) {
      return false;
    }

    this.setNativeValue(element, matchedOption.value);
    this.dispatchChangeEvents(element);
    return true;
  }

  normalizeValueForElement(element, value) {
    const type = (element.type || "").toLowerCase();
    if (type === "date") {
      return this.normalizeDateValue(value);
    }

    return value;
  }

  normalizeDateValue(value) {
    if (!value) {
      return "";
    }

    const text = String(value).trim();
    const ymdMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymdMatch) {
      return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, "0")}-${ymdMatch[3].padStart(2, "0")}`;
    }

    const compactMatch = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
      return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
    }

    return text;
  }

  /**
   * descriptor가 있는 경우 set으로 값변경 아닌경우 직접 할당
   * @param {Element} element 
   * @param {String} value 
   * @returns 
   */
  setNativeValue(element, value) {
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    // react 같은 프레임워크에서 value 프로퍼티에 커스텀 setter가 있을 수 있어서, 직접 value값을 할당할 수 없는 경우가 있음.
    if (descriptor?.set) {
      descriptor.set.call(element, value);
      return;
    }

    element.value = value;
  }

  setNativeChecked(element, checked) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
    if (descriptor?.set) {
      descriptor.set.call(element, checked);
      return;
    }

    element.checked = checked;
  }

  /**
   * input 이벤트와 change 이벤트를 발생시켜 DOM이 변경을 감지하게 함
   * @param {Element} element 
   * @param {String} value 
   */
  dispatchTextEvents(element, value) {
    try {
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: value,
        }),
      );
    } catch (error) {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }

    this.dispatchChangeEvents(element);
  }

  dispatchChangeEvents(element) {
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  isClickable(element) {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && !element.disabled;
  }

  toBoolean(value) {
    if (typeof value === "boolean") {
      return value;
    }

    const normalized = this.normalizeText(value);
    return [
      "true",
      "1",
      "yes",
      "y",
      "on",
      "checked",
      "회사내규에따름",
      "내규에따름",
      "동의",
      "예",
    ].includes(normalized);
  }

  normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .trim();
  }

  wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      });
    });
  }
}

const formAnalyzer = new FormAnalyzer();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze") {
    try {
      const analyzedInputs = formAnalyzer.analyzeInputs();
      const serializedData = analyzedInputs.map((input) => ({
        domKey: input.domKey,
        id: input.id,
        name: input.name,
        tagName: input.tagName,
        type: input.type,
        placeholder: input.placeholder,
        label: input.label,
        ariaLabel: input.ariaLabel,
        required: input.required,
        selector: input.selector,
        sectionText: input.sectionText,
        optionTexts: input.optionTexts,
      }));

      sendResponse({ status: "success", data: serializedData });
    } catch (error) {
      console.error("FormFill AI: analyze 실패", error);
      sendResponse({ status: "error", message: error.message || "필드 분석에 실패했습니다." });
    }

    return true;
  }

  if (request.action === "fill") {
    (async () => {
      try {
        const result = await formAnalyzer.fillForm(request.data || {});
        sendResponse({ status: "success", data: result });
      } catch (error) {
        console.error("FormFill AI: fill 실패", error);
        sendResponse({ status: "error", message: error.message || "폼 자동 입력에 실패했습니다." });
      }
    })();

    return true;
  }

  sendResponse({ status: "error", message: "Unknown action" });
  return true;
});

const GEMINI_MODEL = "gemini-3-flash-preview";
const SCREENSHOT_DELAY_MS = 350;
const MAX_DYNAMIC_STEPS = 6;

class FormAnalyzer {
  constructor() {
    this.inputs = [];
    this.inputMap = new Map();
    this.dynamicInputs = [];
    this.dynamicInputMap = new Map();
    this.dynamicActions = [];
    this.dynamicActionMap = new Map();
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
   * 부모 요소를 타고 올라가면서 children 중에 같은 태그인 요소를 찾음
   * @param {*} element 
   * @returns String (ex. form > div:nth-of-type(2) > input)
   */
  buildSelector(element) {
    if (element.id) {
      return `#${this.escapeSelector(element.id)}`;
    }

    const segments = [];
    let current = element;

    // 부모 요소를 타고 올라가면서 children 중에 같은 태그인 요소를 4개까지 찾음
    while (current && current.nodeType === Node.ELEMENT_NODE && segments.length < 4) {
      let segment = current.tagName.toLowerCase();
      if (current.name) {
        segment += `[name="${current.name.replace(/"/g, '\\"')}"]`;
        segments.unshift(segment);
        break;
      }

      // 형제 요소 중에서 같은 태그 이름을 가진 요소가 여러 개 있는 경우 :nth-of-type() 추가
      const siblings = current.parentElement
        ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName)
        : [];

      // nth-of-type : 똑같은 태그가 2개 이상일때 몇번째 요소인지 확인하기 위함
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

  /**
   * element 기준으로 가장 가까운 상위 섹션의 텍스트를 반환합니다.
   * @param {*} element 
   * @returns 
   */
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

  /**
   * select 요소의 option이나, radio/checkbox의 label 등 입력 가능한 옵션 텍스트를 반환합니다.
   * @param {*} element 
   * @returns 
   */
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
    console.log("FormFill AI: 페이지 스크린샷 캡처 수", screenshots.length);

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

    console.log("FormFill AI: generatePlan 결과", plan);

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

  async attachProfilePhoto(profilePhoto) {
    const normalizedPhoto = this.normalizeProfilePhoto(profilePhoto);
    if (!normalizedPhoto) {
      return {
        attached: false,
        reason: "등록된 사진 데이터가 없습니다.",
      };
    }

    const input = this.findBestPhotoFileInput();
    if (!input) {
      throw new Error("페이지에서 사진 첨부용 파일 입력창을 찾지 못했습니다.");
    }

    const file = await this.createFileFromProfilePhoto(normalizedPhoto);
    const transfer = new DataTransfer();
    transfer.items.add(file);

    input.scrollIntoView({ block: "center", inline: "nearest" });
    await this.wait(60);
    this.setNativeFiles(input, transfer.files);
    this.dispatchFileEvents(input);

    return {
      attached: true,
      fileName: file.name,
      selector: this.buildSelector(input),
    };
  }

  async fillDynamicForm(resumeData) {
    console.log("FormFill AI: 동적 폼 자동 입력 시작");
    const history = [];
    const triggeredActionKeys = new Set();
    let lastChange = null;
    let lastDecision = null;
    let cachedScreenshots = null;

    for (let step = 0; step < MAX_DYNAMIC_STEPS; step += 1) {
      const inputs = this.collectDynamicInputs();
      const actions = this.collectDynamicActions(triggeredActionKeys);
      const shouldRecaptureScreenshots =
        !cachedScreenshots ||
        step === 0 ||
        Boolean(lastChange?.changed);
      const screenshots = shouldRecaptureScreenshots
        ? await this.capturePageScreenshots()
        : cachedScreenshots;

      if (shouldRecaptureScreenshots) {
        cachedScreenshots = screenshots;
      }

      const decision = await this.requestDynamicDecision({
        resumeData,
        inputs,
        actions,
        lastChange,
        lastDecision,
        history,
        step,
      }, screenshots);

      lastDecision = decision;

      if (!decision || decision.nextStep === "done") {
        return {
          summary: decision?.summary || "동적 입력이 완료되었습니다.",
          history,
          lastChange,
          decision,
        };
      }

      if (decision.nextStep === "trigger") {
        const actionKey = decision.trigger?.actionKey;
        const actionData = actionKey ? this.dynamicActionMap.get(actionKey) : null;

        if (!actionData) {
          history.push({
            step: step + 1,
            kind: "trigger",
            status: "skipped",
            reason: "모델이 지정한 동적 요소를 찾지 못했습니다.",
            requestedActionKey: actionKey || "",
          });
          continue;
        }

        const change = await this.executeDynamicAction(actionData, decision.trigger || {});
        triggeredActionKeys.add(actionData.actionKey);
        lastChange = change;
        if (change.changed) {
          cachedScreenshots = null;
        }
        history.push({
          step: step + 1,
          kind: "trigger",
          status: change.changed ? "applied" : "noop",
          actionKey: actionData.actionKey,
          label: actionData.label,
          actionType: actionData.actionType,
          reason: decision.trigger?.reason || "",
          change,
        });
        continue;
      }

      if (decision.nextStep === "fill") {
        const applied = [];

        for (const field of decision.fillTargets || []) {
          const inputData = field?.inputKey ? this.dynamicInputMap.get(field.inputKey) : null;
          if (!inputData) {
            continue;
          }

          const resolvedValue = this.resolvePlanValue(field, resumeData);
          const didApply = await this.applyPlannedValue(inputData.element, resolvedValue, field);

          if (didApply) {
            applied.push({
              inputKey: inputData.inputKey,
              fieldLabel: field.fieldLabel || inputData.label || inputData.name || inputData.id,
              value: resolvedValue,
            });
          }
        }

        history.push({
          step: step + 1,
          kind: "fill",
          status: applied.length ? "applied" : "noop",
          applied,
        });

        if (!decision.continueAfterFill) {
          return {
            summary: decision.summary || "동적 입력이 완료되었습니다.",
            history,
            lastChange,
            decision,
          };
        }

        lastChange = {
          changed: applied.length > 0,
          reason: "입력값 적용 후 재탐색",
          newInputKeys: applied.map((item) => item.inputKey),
          summary: `${applied.length}개 필드에 값을 입력했습니다.`,
        };

        if (applied.length > 0) {
          cachedScreenshots = null;
        }
      }
    }

    return {
      summary: "최대 동적 탐색 횟수에 도달했습니다.",
      history,
      lastChange,
      lastDecision,
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

  collectDynamicInputs() {
    this.dynamicInputs = [];
    this.dynamicInputMap.clear();

    const elements = Array.from(document.querySelectorAll("input, select, textarea"));
    let index = 0;

    elements.forEach((element) => {
      if (!this.isFillableElement(element) || !this.isVisibleElement(element)) {
        return;
      }

      const inputKey = this.buildDynamicKey("input", element, index);
      const inputData = {
        inputKey,
        element,
        tagName: element.tagName.toLowerCase(),
        type: (element.type || "").toLowerCase(),
        id: element.id || "",
        name: element.name || "",
        label: this.findLabelFor(element),
        placeholder: element.placeholder || "",
        ariaLabel: element.getAttribute("aria-label") || "",
        selector: this.buildSelector(element),
        sectionText: this.getSectionText(element),
        optionTexts: this.getOptionTexts(element),
        currentValue: this.getCurrentElementValue(element),
      };

      this.dynamicInputs.push(inputData);
      this.dynamicInputMap.set(inputKey, inputData);
      index += 1;
    });

    return this.dynamicInputs.map((input) => ({
      inputKey: input.inputKey,
      tagName: input.tagName,
      type: input.type,
      id: input.id,
      name: input.name,
      label: input.label,
      placeholder: input.placeholder,
      ariaLabel: input.ariaLabel,
      selector: input.selector,
      sectionText: input.sectionText,
      optionTexts: input.optionTexts,
      currentValue: input.currentValue,
    }));
  }

  /**
   * 
   * @param {*} triggeredActionKeys 
   * @returns 
   */
  collectDynamicActions(triggeredActionKeys = new Set()) {
    this.dynamicActions = [];
    this.dynamicActionMap.clear();

    const selector = [
      "button",
      "[role='button']",
      "[role='tab']",
      "[role='option']",
      "summary",
      "a[href]",
      "label",
      "input[type='radio']",
      "input[type='checkbox']",
      "select",
    ].join(", ");
    const elements = Array.from(document.querySelectorAll(selector));
    let index = 0;

    elements.forEach((element) => {
      if (!this.isActionableElement(element)) {
        return;
      }

      const actionKey = this.buildDynamicKey("action", element, index);
      // 이미 이전에 이벤트를 수행했던 태그의 경우 포함하지 않음
      if (triggeredActionKeys.has(actionKey)) {
        index += 1;
        return;
      }

      const actionData = {
        actionKey,
        element,
        tagName: element.tagName.toLowerCase(),
        type: (element.type || "").toLowerCase(),
        id: element.id || "",
        name: element.name || "",
        role: element.getAttribute("role") || "",
        selector: this.buildSelector(element),
        label: this.getElementTextSummary(element),
        sectionText: this.getSectionText(element),
        actionType: this.inferActionType(element),
        value: this.getCurrentElementValue(element),
        optionTexts: element.tagName === "SELECT" ? this.getOptionTexts(element) : [],
      };

      this.dynamicActions.push(actionData);
      this.dynamicActionMap.set(actionKey, actionData);
      index += 1;
    });

    return this.dynamicActions.map((action) => ({
      actionKey: action.actionKey,
      tagName: action.tagName,
      type: action.type,
      id: action.id,
      name: action.name,
      role: action.role,
      selector: action.selector,
      label: action.label,
      sectionText: action.sectionText,
      actionType: action.actionType,
      value: action.value,
      optionTexts: action.optionTexts,
    }));
  }

  buildDynamicKey(prefix, element, index) {
    const seed = [
      this.buildSelector(element),
      element.id,
      element.name,
      element.getAttribute("role"),
      element.getAttribute("aria-label"),
      this.getElementTextSummary(element),
      element.tagName.toLowerCase(),
      element.type,
    ]
      .filter(Boolean)
      .join("_");
    const sanitized = String(seed || `${prefix}_${index}`)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);
    return `${prefix}_${sanitized || String(index).padStart(3, "0")}`;
  }

  /**
   * element의 현재 값을 반환
   * @param {*} element 
   * @returns 
   */
  getCurrentElementValue(element) {
    if (!element) {
      return "";
    }

    if (element.tagName === "SELECT") {
      const selectedOption = element.options?.[element.selectedIndex];
      return selectedOption?.textContent?.trim() || element.value || "";
    }

    if ((element.type || "").toLowerCase() === "checkbox" || (element.type || "").toLowerCase() === "radio") {
      return element.checked ? (element.value || true) : "";
    }

    return element.value || "";
  }

  /**
   * element에서 텍스트 후보군을 최대한 추출해서 반환
   * @param {*} element 
   * @returns 
   */
  getElementTextSummary(element) {
    if (!element) {
      return "";
    }

    // innerText, textContent등 값이 있는것만 추출
    const candidates = [
      element.innerText,
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.value,
      this.findLabelFor(element),
    ]
      .map((text) => String(text || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    // !@#$ 후보군 텍스트 중에서 제일 첫번째값만 사용하는 한계점이 존재
    return (candidates[0] || "").slice(0, 120);
  }

  /**
   * tagName과 type을 기반으로 이 요소가 어떤 이벤트 유형일지 추론
   * @param {*} element 
   * @returns 
   */
  inferActionType(element) {
    const tagName = element.tagName.toLowerCase();
    const type = (element.type || "").toLowerCase();

    if (tagName === "select") {
      return "select";
    }

    if (type === "checkbox") {
      return "check";
    }

    if (type === "radio") {
      return "radio";
    }

    return "click";
  }

  isVisibleElement(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  isActionableElement(element) {
    if (!element || !this.isVisibleElement(element) || element.disabled) {
      return false;
    }

    if (this.isFillableElement(element)) {
      const type = (element.type || "").toLowerCase();
      return type === "radio" || type === "checkbox" || element.tagName === "SELECT";
    }

    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    return tagName === "button" || tagName === "summary" || tagName === "a" || tagName === "label" || role === "button" || role === "tab" || role === "option";
  }

  async requestDynamicDecision(context, screenshots) {
    const prompt = this.buildDynamicPrompt(context, screenshots);
    const response = await this.sendRuntimeMessage({
      action: "generateGeminiPlan",
      payload: {
        model: GEMINI_MODEL,
        prompt,
        screenshots,
      },
    });

    if (!response?.success || !response.plan) {
      throw new Error(response?.message || "동적 폼 판단에 실패했습니다.");
    }

    console.log("FormFill AI: requestDynamicDecision 결과", response.plan);

    return response.plan;
  }

  buildDynamicPrompt(context, screenshots) {
    const imageNames = screenshots.map((screenshot) => screenshot.fileName);
    const compactResumeData = Object.fromEntries(
      Object.entries(context.resumeData || {}).filter(([, value]) => {
        if (typeof value === "boolean") {
          return value;
        }

        return String(value || "").trim() !== "";
      }),
    );

    return `
당신은 동적 채용 지원서의 입력 순서를 판단하는 도우미입니다.

목표:
1. 현재 화면에서 먼저 이벤트를 주어야 할 요소가 있는지 찾습니다.
2. 이벤트 수행 후 생긴 변화 요약을 보고 다시 이벤트가 필요한지, 값을 입력해야 하는지 판단합니다.
3. 값을 입력해야 한다면 변화가 일어난 영역을 우선 참고해 실제 입력할 태그를 지정합니다.
4. 반환은 순수 JSON만 합니다. 코드블록은 금지합니다.

현재 단계: ${context.step + 1}

스크린샷 파일 목록:
${imageNames.map((name, index) => `${index + 1}. ${name}`).join("\n")}

resumeData:
${JSON.stringify(compactResumeData, null, 2)}

현재 입력 가능한 태그 목록:
${JSON.stringify(context.inputs || [], null, 2)}

현재 먼저 이벤트를 줄 수 있는 후보 목록:
${JSON.stringify(context.actions || [], null, 2)}

직전 변화 요약:
${JSON.stringify(context.lastChange || null, null, 2)}

지금까지 수행 이력:
${JSON.stringify(context.history || [], null, 2)}

반환 형식:
{
  "summary": "현재 상태 요약",
  "nextStep": "trigger | fill | done",
  "trigger": {
    "actionKey": "actions 목록에 있는 actionKey",
    "value": "select일 때 선택할 값, 아니면 빈 문자열 가능",
    "reason": "왜 먼저 이 이벤트가 필요한지"
  },
  "fillTargets": [
    {
      "inputKey": "inputs 목록에 있는 inputKey",
      "fieldLabel": "화면 항목명",
      "resumeKey": "resumeData의 key 또는 etc",
      "inputType": "text | textarea | number | date | email | tel | checkbox | radio | select | unknown",
      "action": "type | click | select | check | skip",
      "value": "실제로 넣을 값",
      "why": "왜 이 태그에 이 값을 넣는지"
    }
  ],
  "continueAfterFill": true
}

판단 규칙:
- 숨겨진 필드를 억지로 채우지 마세요.
- 탭, 아코디언, 라디오, 체크박스, 셀렉트처럼 다른 필드를 드러내는 요소가 보이면 trigger를 우선 검토하세요.
- 직전 변화 요약에 새 입력 태그가 생겼다면 그 변화 영역의 태그를 우선 fillTargets에 넣으세요.
- 값이 불확실하면 해당 필드는 skip 처리하거나 done을 선택하세요.
- 이미 수행한 actionKey는 반복 선택하지 마세요.
- 모든 inputKey, actionKey는 제공된 목록 중 하나를 그대로 사용하세요.
- 다음 페이지로 넘어가는 버튼은 선택하지 마세요.
`.trim();
  }

  /**
   * LLM이 지정한 동적 요소에 이벤트를 수행하고, 페이지의 변화를 감지해서 요약 정보를 반환
   * @param {*} actionData 
   * @param {*} instruction 
   * @returns 
   */
  async executeDynamicAction(actionData, instruction) {
    const element = actionData?.element;
    if (!element) {
      return {
        changed: false,
        summary: "동적 요소가 존재하지 않습니다.",
      };
    }

    element.scrollIntoView({ block: "center", inline: "nearest" });
    await this.wait(80);

    const beforeInputs = this.collectDynamicInputs();
    const beforeActions = this.collectDynamicActions();
    const beforeFingerprint = this.buildPageFingerprint();

    await this.performActionInstruction(element, actionData, instruction);
    await this.wait(500);

    const afterInputs = this.collectDynamicInputs();
    const afterActions = this.collectDynamicActions();
    const afterFingerprint = this.buildPageFingerprint();

    return this.summarizeDynamicChange({
      actionData,
      beforeInputs,
      afterInputs,
      beforeActions,
      afterActions,
      beforeFingerprint,
      afterFingerprint,
    });
  }

  /**
   * actionType에 따라 click, select, check 등의 이벤트를 수행
   * @param {*} element 
   * @param {*} actionData 
   * @param {*} instruction 
   * @returns 
   */
  async performActionInstruction(element, actionData, instruction) {
    // select의 경우 값을 선택하고 mousedown 이벤트 발생
    if (actionData.actionType === "select") {
      const selected = this.applySelectValue(element, instruction?.value || "");
      if (!selected && this.isClickable(element)) {
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        element.focus();
      }
      return;
    }

    // 
    if (actionData.actionType === "check" || actionData.actionType === "radio") {
      if (this.isClickable(element)) {
        element.click();
        return;
      }

      this.setNativeChecked(element, true);
      this.dispatchChangeEvents(element);
      return;
    }

    if (this.isClickable(element)) {
      element.click();
      return;
    }

    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }

  /**
   * 페이지의 변화를 감지하기위한 요소들을 추출해서 반환
   * @returns 
   */
  buildPageFingerprint() {
    const rootText = (document.body?.innerText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);

    // !@#$ url과 title이 바뀔 경우가 있을지? 
    // !@#$ 페이지 전체 text를 가져와서 800자만 쓰면 변화 감지에 한계가 있지 않을까?
    return {
      url: window.location.href,
      title: document.title,
      textSample: rootText,
      inputCount: document.querySelectorAll("input, select, textarea").length,
      actionCount: document.querySelectorAll("button, [role='button'], [role='tab'], summary, a[href], label").length,
    };
  }

  /**
   * 새로 생기거나 없어진 태그가 있는지 text fingerprint과 함께 비교해서 변화 요약을 반환
   * @param {*} payload 
   * @returns 
   */
  summarizeDynamicChange(payload) {
    const beforeInputKeys = new Set((payload.beforeInputs || []).map((item) => item.inputKey));
    const afterInputKeys = new Set((payload.afterInputs || []).map((item) => item.inputKey));
    const beforeActionKeys = new Set((payload.beforeActions || []).map((item) => item.actionKey));
    const afterActionKeys = new Set((payload.afterActions || []).map((item) => item.actionKey));

    const newInputs = (payload.afterInputs || []).filter((item) => !beforeInputKeys.has(item.inputKey));
    const removedInputs = (payload.beforeInputs || []).filter((item) => !afterInputKeys.has(item.inputKey));
    const newActions = (payload.afterActions || []).filter((item) => !beforeActionKeys.has(item.actionKey));
    const removedActions = (payload.beforeActions || []).filter((item) => !afterActionKeys.has(item.actionKey));
    const fingerprintChanged =
      JSON.stringify(payload.beforeFingerprint || {}) !== JSON.stringify(payload.afterFingerprint || {});

    return {
      changed: fingerprintChanged || newInputs.length > 0 || removedInputs.length > 0 || newActions.length > 0 || removedActions.length > 0,
      summary: [
        newInputs.length ? `새 입력 태그 ${newInputs.length}개` : "",
        removedInputs.length ? `사라진 입력 태그 ${removedInputs.length}개` : "",
        newActions.length ? `새 이벤트 후보 ${newActions.length}개` : "",
        removedActions.length ? `사라진 이벤트 후보 ${removedActions.length}개` : "",
      ]
        .filter(Boolean)
        .join(", ") || "감지된 구조 변화가 없습니다.",
      actionKey: payload.actionData?.actionKey || "",
      actionLabel: payload.actionData?.label || "",
      newInputKeys: newInputs.map((item) => item.inputKey),
      removedInputKeys: removedInputs.map((item) => item.inputKey),
      newActionKeys: newActions.map((item) => item.actionKey),
      removedActionKeys: removedActions.map((item) => item.actionKey),
    };
  }

  /**
   * tagname과 type에 따라 값을 자동으로 입력함(성공, 실패 여부 반환)
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

  /**
   * input type select의 options를 탐색해 value와 일치하는 옵션 체크
   * @param {Element} element 
   * @param {String} value 
   * @returns 
   */
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

  normalizeProfilePhoto(profilePhoto = null) {
    if (!profilePhoto || typeof profilePhoto !== "object") {
      return null;
    }

    const dataUrl = String(profilePhoto.dataUrl || "").trim();
    if (!dataUrl.startsWith("data:image/")) {
      return null;
    }

    return {
      name: String(profilePhoto.name || "profile-photo").trim() || "profile-photo",
      type: String(profilePhoto.type || "image/jpeg").trim() || "image/jpeg",
      lastModified: Number(profilePhoto.lastModified || 0) || Date.now(),
      dataUrl,
    };
  }

  async createFileFromProfilePhoto(profilePhoto) {
    const response = await fetch(profilePhoto.dataUrl);
    const blob = await response.blob();
    return new File([blob], profilePhoto.name, {
      type: profilePhoto.type || blob.type || "image/jpeg",
      lastModified: profilePhoto.lastModified || Date.now(),
    });
  }

  findBestPhotoFileInput() {
    const candidates = Array.from(document.querySelectorAll("input[type='file']"))
      .map((element, index) => ({
        element,
        score: this.scorePhotoFileInput(element, index),
      }))
      .filter((item) => item.score > Number.NEGATIVE_INFINITY)
      .sort((left, right) => right.score - left.score);

    return candidates[0]?.element || null;
  }

  scorePhotoFileInput(element, index) {
    if (!element || element.disabled) {
      return Number.NEGATIVE_INFINITY;
    }

    let score = 0;
    const accept = String(element.getAttribute("accept") || "").toLowerCase();
    const summary = this.normalizeText([
      element.id,
      element.name,
      element.className,
      element.getAttribute("aria-label"),
      this.findLabelFor(element),
      this.getSectionText(element),
      this.getAssociatedLabelText(element),
    ].join(" "));

    if (accept.includes("image")) {
      score += 7;
    } else if (!accept || [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].some((token) => accept.includes(token))) {
      score += 3;
    } else {
      score -= 3;
    }

    if (/(사진|증명|프로필|이미지|photo|image|picture|portrait|avatar)/.test(summary)) {
      score += 10;
    }

    if (/(이력서|지원서|인적사항|face|profile)/.test(summary)) {
      score += 4;
    }

    if (/(첨부|등록|업로드|upload|attach)/.test(summary)) {
      score += 3;
    }

    if (/(사업자|계약서|첨부파일|pdf|doc|excel|zip)/.test(summary)) {
      score -= 6;
    }

    if (this.isVisibleElement(element)) {
      score += 2;
    }

    score -= Math.min(index, 8);
    return score;
  }

  getAssociatedLabelText(element) {
    if (!element) {
      return "";
    }

    const parentLabel = element.closest("label");
    if (parentLabel?.innerText?.trim()) {
      return parentLabel.innerText.trim();
    }

    const precedingLabel = element.previousElementSibling;
    if (precedingLabel?.tagName === "LABEL" && precedingLabel.innerText?.trim()) {
      return precedingLabel.innerText.trim();
    }

    return "";
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

  setNativeFiles(element, files) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
    if (descriptor?.set) {
      descriptor.set.call(element, files);
      return;
    }

    element.files = files;
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

  dispatchFileEvents(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
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
        let start_time = Date.now();
        const result = await formAnalyzer.fillForm(request.data || {});
        console.log("FormFill AI: fill 총 소요 시간", (Date.now() - start_time) / 1000, "초");
        sendResponse({ status: "success", data: result });
      } catch (error) {
        console.error("FormFill AI: fill 실패", error);
        sendResponse({ status: "error", message: error.message || "폼 자동 입력에 실패했습니다." });
      }
    })();

    return true;
  }

  if (request.action === "attachPhoto") {
    (async () => {
      try {
        const result = await formAnalyzer.attachProfilePhoto(request.data || {});
        sendResponse({ status: "success", data: result });
      } catch (error) {
        console.error("FormFill AI: attachPhoto 실패", error);
        sendResponse({ status: "error", message: error.message || "사진 첨부에 실패했습니다." });
      }
    })();

    return true;
  }

  if (request.action === "fillDynamic") {
    (async () => {
      try {
        let start_time = Date.now();
        const result = await formAnalyzer.fillDynamicForm(request.data || {});
        console.log("FormFill AI: fillDynamic 총 소요 시간", (Date.now() - start_time) / 1000, "초");
        sendResponse({ status: "success", data: result });
      } catch (error) {
        console.error("FormFill AI: fillDynamic 실패", error);
        sendResponse({ status: "error", message: error.message || "동적 폼 자동 입력에 실패했습니다." });
      }
    })();

    return true;
  }

  sendResponse({ status: "error", message: "Unknown action" });
  return true;
});

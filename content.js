// content.js - FormFill AI 핵심 로직

class FormAnalyzer {
    constructor() {
        this.inputs = [];
        this.hiddenInputs = new Map();
        
        // project.md: DOM 변화를 감시하는 코드
        // 드롭다운 등 히든 처리된 태그 조작을 위해 변화 감지
        this.observer = new MutationObserver(this.handleMutations.bind(this));
        
        // 우선 문서 전체 또는 주요 폼 영역을 감시 대상으로 설정
        const config = { attributes: true, childList: true, subtree: true };
        this.observer.observe(document.body, config);
    }

    // 1. 입력해야 할 태그(input) 찾기
    analyzeInputs() {
        this.inputs = [];
        // 일반적인 텍스트 입력 필드들 탐색
        const inputElements = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
        
        inputElements.forEach(input => {
            const inputData = {
                element: input,
                type: input.type,
                id: input.id,
                name: input.name,
                // project.md: placeholder가 있다면 placeholder로 어떤 정보인지 유추가능
                placeholder: input.placeholder || '',
                label: this.findLabelFor(input)
            };
            this.inputs.push(inputData);
        });

        console.log('FormFill AI: 폼 인풋 분석 완료', this.inputs);
        return this.inputs;
    }

    // Input과 연관된 Label 텍스트 찾기 (유추의 단서를 위해)
    findLabelFor(input) {
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label.innerText.trim();
        }
        
        const parentLabel = input.closest('label');
        if (parentLabel) {
            return parentLabel.innerText.trim();
        }
        
        return '';
    }

    // DOM 변화 감지 (히든 처리된 input 파악용)
    handleMutations(mutations) {
        mutations.forEach(mutation => {
            // 버튼 요소 등 항목을 선택했을 때 값이 바뀌는 hidden 처리된 input 감시
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                if (target.tagName === 'INPUT' && target.type === 'hidden') {
                    if (mutation.attributeName === 'value') {
                        console.log('FormFill AI: 히든 인풋 값 변경 감지', target.name, target.value);
                    }
                }
            } else if (mutation.type === 'childList') {
                // 노드가 새로 추가될 때 내부의 히든 인풋 등을 미리 파악해둘 수 있음
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const hiddens = node.querySelectorAll('input[type="hidden"]');
                        hiddens.forEach(hidden => {
                            if (!this.hiddenInputs.has(hidden)) {
                                this.hiddenInputs.set(hidden, { name: hidden.name, id: hidden.id });
                            }
                        });
                    }
                });
            }
        });
    }

    // AI가 반환한 정보를 태그에 입력
    fillForm(dataMapping) {
        // dataMapping 예시: { 'name': '홍길동', 'email': 'test@test.com' }
        this.inputs.forEach(inputData => {
            // placeholder, name, label 등 정보를 기반으로 dataMapping과 매핑된 결과를 찾음
            // (이곳은 간단히 name이나 id 매핑 예시, 실제로는 AI가 타겟 태그정보까지 식별하여 데이터를 전달해야함)
            const mappingKey = inputData.name || inputData.id;
            
            if (mappingKey && dataMapping[mappingKey]) {
                inputData.element.value = dataMapping[mappingKey];
                
                // 프론트엔드 프레임워크(React, Vue 등)의 상태 업데이트 트리거를 위한 이벤트 발생
                inputData.element.dispatchEvent(new Event('input', { bubbles: true }));
                inputData.element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        console.log('FormFill AI: 자동 완성 완료');
    }
}

const formAnalyzer = new FormAnalyzer();

// 팝업이나 백그라운드 스크립트와의 통신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze") {
        const analyzedInputs = formAnalyzer.analyzeInputs();
        
        // Element 객체 자체는 메시지로 보낼 수 없으므로 직렬화 가능한 정보만 추출
        const serializedData = analyzedInputs.map(input => ({
            id: input.id,
            name: input.name,
            type: input.type,
            placeholder: input.placeholder,
            label: input.label
        }));
        
        sendResponse({ status: "success", data: serializedData });
    } 
    else if (request.action === "fill") {
        formAnalyzer.fillForm(request.data);
        sendResponse({ status: "success" });
    }
    
    // 비동기 응답 처리 허용
    return true;
});

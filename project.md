## 프로젝트 목적
각 기업들의 채용 사이트에서 지원서를 ai를 통해 자동으로 채워주는 크롬 확장 프로그램
이름, 나이, 군필여부, 학력, 경력, 연락처, 이메일 등 기본적인 정보를 적절한 위치에 채워넣는 것이 목표

## 처리 과정
1. 지원서 페이지에서 입력해야할 태그들을 찾음
2. 각 태그들이 어떤 정보를 입력해야하는 태그인지 판단
3. 판단된 정보를 기반으로 ai에게 정보를 요청
4. ai가 반환한 정보를 태그에 입력되게 브라우저 조작

## 기술 스택
- 크롬 확장 프로그램

## 핵심 문제 사항
1. 이력을 채워넣어야할 태그를 어떻게 찾을 것인가?
2. 각 태그가 어떤 정보를 입력해야하는 태그인지 어떻게 판단할 것인가?
3. 히든 처리된 태그들을 어떻게 조작해 값을 넘길 것인가?

## 기능 개발
1. 입력해야할 태그 찾기
    - input 태그
        - 각 태그들이 어떤 태그인지(이름, 생년월일 인지 등)을 파악해 매핑해야함
        1. placeholder가 있다면 placeholder로 유추가능함
    - button 타입 태그의 selector
        - button을 누르기 전까지 목록을 확인할 수 없음
        - 항목을 선택했을때 값이 바뀌는 hidden 처리된 input을 찾아야함
            - dom의 변화를 감지해 파악할수도 있을듯
            
            ```jsx
            // DOM 변화를 감시하는 코드
            const observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                console.log('변경 감지:', mutation.target);
              });
            });
            
            // 드롭다운 부모 요소를 감시 대상으로 설정
            const config = { attributes: true, childList: true, subtree: true };
            observer.observe(document.querySelector('.emergency-contact-wrapper'), config);
            ```
            
2. AI가 판단해야할 것
    - input 태그의 경우, placeholder를 기반으로 어떤 값을 넣어야하는 input 태그인지 유추
    - selector인지 판단
        - selector 항목을 보고 어떤걸 선택해야하는지 판단
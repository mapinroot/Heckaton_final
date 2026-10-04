# ReGround V4 — Machine alternative requests

V3 디자인과 4개 메뉴를 유지하면서 **Projects → Loads → Alternative requests**를 추가했습니다.

기계 조건 불일치 읽기 → 배치별 대체 수용자 요청 → 승인 / 추가 검사 / 거절 → 새 측정값 재검증 → PASS 출고 → 대체 현장 입고 확인 흐름입니다. 최초 조건 불일치 기록과 이력을 보존하며 기본 프로젝트 경로는 바꾸지 않습니다.

기계 읽기는 브라우저 어댑터와 JSON 입력으로 수신합니다. 실제 장비·서버 연결은 아직 없습니다. [MACHINE-INTEGRATION.md](MACHINE-INTEGRATION.md)에 입력 형식과 연결 범위가 있습니다. V4는 reground-v4 저장소를 사용하고 최초 실행 시 V3 기록을 가져옵니다. 이전 V3 파일과 다운로드는 보존했습니다. 단일 파일은 ReGround-V4.html입니다.

V4 브라우저 검증: 기계 HOLD 요청 생성, 수용자의 검토 확인 없는 승인 차단, 승인 후 재검증 HOLD와 PASS, 대체 경로 출고 및 입고 집계, 재시작 후 원기록 보존, 오염 의심 FAIL의 대체 요청 차단을 확인했습니다.

---

# ReGround V3 — Shared project workspace

로컬에서 실행하는 B2B/B2G soil routing 프로토타입입니다.

## 실행

`index.html`을 브라우저에서 열 수 있습니다. 서버로 실행하려면 이 폴더에서 `python3 -m http.server 4173 --bind 127.0.0.1`을 실행하고 http://127.0.0.1:4173/을 여세요. 설치나 빌드는 필요 없습니다. `ReGround-V3.html`은 CSS와 JavaScript가 포함된 단일 파일입니다.

## V3 사용자 경험

- 주요 메뉴를 **Home / Projects / Activity / Reports** 네 개로 축소했습니다.
- Home의 **Up next**에서 현재 역할의 다음 작업으로 이동합니다. 상대 팀의 작업은 담당 역할을 표시합니다.
- 프로젝트 안에 **Overview / Plan & route / Evidence / Loads**를 모았습니다.
- 공급자와 수용자 정보, 경로, 증빙 상태와 배송 기록을 같은 프로젝트에서 볼 수 있습니다.
- Supplier는 물량 예측, 경로 선택, 증빙, 현장 검증과 출고를 담당합니다.
- Receiver는 현장 조건, 증빙 검토, 조건부 승인과 입고 확인을 담당합니다.
- 기술적 수용 조건과 경로 원가·용량·날짜는 펼쳐서 볼 수 있습니다.
- 모바일 메뉴, 키보드 포커스, 직접 연결된 입력 라벨, 텍스트 상태 표시, reduced motion을 지원합니다.

## 권장 체험 순서

1. Supplier → Projects → Plan & route: 예측 물량과 세 가지 경로를 확인합니다.
2. Evidence: 공급자 증빙을 기록합니다. Receiver 승인 항목은 공급자가 수정할 수 없습니다.
3. Receiver → 해당 receiving site → Projects → Evidence: 현장 조건과 증빙을 확인하고 조건부 승인합니다.
4. Supplier → Projects → Loads → Check a batch: 측정값을 기록합니다. PASS이며 승인·재료·용량·날짜 조건을 충족하는 배치만 Dispatch load가 활성화됩니다.
5. Receiver → Projects → Loads: 입고 물량과 기록을 확인하고 Confirm receipt를 완료합니다.
6. Home 및 Reports에서 수령 완료 물량이 갱신됩니다. HOLD / FAIL은 출고할 수 없습니다.

## 디자인·기획 근거

PropertyMe의 공개 ‘Properties and client views’와 Owner Property Details 화면을 확인했습니다. 여러 당사자를 하나의 상세 화면에 묶고, Up Next / Recent Activities / Property Info를 제공하는 구조를 ReGround에 맞춰 적용했습니다. 로고·사진·코드는 복제하지 않았습니다.

- https://www.propertyme.com.au/features/property-view
- https://support.propertyme.com.au/hc/en-us/articles/4687127151129-Property-Details-Overview-Web-Access-Owner

사용자가 지정한 저장소를 읽기 전용으로 확인했습니다:

- https://github.com/Wellyboys/climate-hacktion-2026
- 확인한 HEAD: `9376005563ab2277ff00220ff80df57449f1687d`
- README의 Forecast → Match → Verify → Reuse, PASS / HOLD / FAIL 및 source-to-receiver 기록 흐름을 반영했습니다.
- `ReGround_Auckland_Soil_Demand_Report.md`의 용도별 material / quantity / timing / location 조건을 유지했습니다.
- 저장소는 보고서, R 분석 및 웹 기획 프롬프트 중심으로 구성되어 있습니다. 해당 저장소의 완성 웹 앱이나 API와 연동된 결과는 아닙니다.
- 보고서의 Auckland 전체 시나리오 숫자를 이 프로젝트의 실측 성과로 사용하지 않았습니다.

## 데이터·기능 범위

- 실제 계정이나 서버는 없습니다. Viewing as는 동일 브라우저에서 두 역할을 체험하는 전환 기능이며 보안 인증이 아닙니다.
- V3는 `reground-v3` 브라우저 저장소를 사용합니다. 최초 실행 시 같은 origin의 V2 기록을 가져오며 V2 다운로드 파일은 보존했습니다. 이후 V3 수정은 V3 저장소에 저장됩니다.
- 두 회사·두 기기 간 실시간 동기화, 승인 요청 전송, 운송 예약, GPS, 계근대, 실험실 및 규제기관 연동은 구현하지 않았습니다.
- 배송은 수동 출고·입고 상태입니다. 물량이 다른 입고 기록은 완료 처리되지 않습니다.
- 증빙은 체크와 문서 참조 메모입니다. 파일 업로드 및 전문 검토를 대신하지 않습니다.
- 경로 거리·운송 단가·수용 조건은 데모 가정입니다. 지도는 축척 없는 도식입니다.
- 현장 PASS는 데모 조건 충족이며 오염 인증이 아닙니다. fallback도 독립적인 수용 검토가 필요합니다.
- 수용자 물량 요청은 로컬 초안입니다. 부분 물량 계약·예약은 구현하지 않았으며 승인 시 전체 source forecast와 site capacity를 비교합니다.
- Supplier 보고서는 가정 운송 비용 및 tonne-km 기반입니다. Receiver 보고서는 현장 수령 물량을 표시합니다.

## 확인한 내용

공급자/수용자 역할 전환, 사이트별 기준·집계, 수용자 승인, PASS 배치 생성·출고, 같은 배치의 수용자 표시, 입고 기록과 집계 갱신, 프로젝트 탭 이동, 모바일 홈 및 메뉴 접근을 브라우저에서 확인했습니다. 실제 서버 인증 및 다중 사용자 동시 운영은 검증 대상에 포함되지 않습니다.

## 파일

- `app.js`: 기존 데이터 모델, 판정 및 역할별 작업 화면
- `v3.js`: 공통 프로젝트 UI, 네 개의 메뉴 및 V3 저장소
- `styles.css`: 반응형 디자인
- `index.html`: 진입 화면

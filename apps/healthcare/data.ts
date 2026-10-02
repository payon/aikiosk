export interface Equipment {
  id: string;
  name: string;
  desc: string;
  time: string;
  level: string;
  steps: { title: string; body: string }[];
  cautions: string[];
  checklist: string[];
}

export const EQUIPMENTS: Equipment[] = [
  {
    id: "lowfreq",
    name: "저주파 자극기 MINI",
    desc: "근육통 완화를 위한 저주파 패드 이용법",
    time: "약 15분",
    level: "초급",
    steps: [
      { title: "1. 전원 연결", body: "어댑터를 연결하고 본체 전원 버튼을 2초간 누릅니다. 표시창에 잔량이 뜹니다." },
      { title: "2. 패드 부착", body: "통증 부위 피부를 닦고 패드 2장을 5cm 간격으로 붙입니다." },
      { title: "3. 모드 선택", body: "두드림·지압·안마 중 선택 후 강도는 1부터 올립니다." },
      { title: "4. 시간 설정", body: "15분을 권장합니다. 종료 후 패드를 떼어 필름에 보관합니다." }
    ],
    cautions: ["심장 박동기 착용자는 사용 금지", "하루 2회 초과 금지", "상처·습진 부위 부착 금지"],
    checklist: ["전원 표시 확인", "패드 점착력 확인", "강도 1부터 시작", "사용 후 패드 보관"]
  },
  {
    id: "heat",
    name: "온열 찜질기 MINI",
    desc: "어깨·허리 온열 찜질과 온도 조절법",
    time: "약 20분",
    level: "초급",
    steps: [
      { title: "1. 커버 장착", body: "전용 커버를 씌우고 지퍼를 끝까지 닫습니다." },
      { title: "2. 온도 설정", body: "저온(40℃)부터 시작해 중온(50℃)까지 단계 조절합니다." },
      { title: "3. 부위 밀착", body: "어깨·허리에 밀착시키고 밴드로 고정합니다." },
      { title: "4. 종료·정리", body: "20분 후 자동 종료됩니다. 충분히 식힌 뒤 보관합니다." }
    ],
    cautions: ["고온(60℃) 10분 초과 금지", "수면 중 사용 금지", "당뇨·감각저하자 보호자 동반"],
    checklist: ["커버 장착 확인", "저온 시작", "밴드 고정", "자동 종료 확인"]
  },
  {
    id: "air",
    name: "공기압 마사지기 MINI",
    desc: "종아리·발 공기압 마사지 코스",
    time: "약 20분",
    level: "중급",
    steps: [
      { title: "1. 커프 착용", body: "종아리에 커프를 감고 호스를 본체에 연결합니다." },
      { title: "2. 코스 선택", body: "순환·집중·릴렉스 코스 중 선택합니다." },
      { title: "3. 압력 조절", body: "약·중·강 3단계, 처음엔 약으로 시작합니다." },
      { title: "4. 종료", body: "공기를 완전히 배출한 뒤 커프를 분리합니다." }
    ],
    cautions: ["혈전·정맥염 의심 시 사용 금지", "임산부 복부 압박 금지", "호스 꺾임 주의"],
    checklist: ["호스 연결 확인", "약 압력 시작", "20분 코스 완료", "공기 배출"]
  },
  {
    id: "infrared",
    name: "적외선 치료기 MINI",
    desc: "무릎·관절 적외선 조사와 거리 유지법",
    time: "약 10분",
    level: "중급",
    steps: [
      { title: "1. 조사부 청소", body: "렌즈를 마른 천으로 닦습니다." },
      { title: "2. 거리 유지", body: "피부에서 30cm 거리를 유지하고 고정합니다." },
      { title: "3. 조사 시작", body: "10분 타이머를 설정하고 눈을 가립니다." },
      { title: "4. 종료", body: "전원을 끄고 렌즈 커버를 닫습니다." }
    ],
    cautions: ["눈 직접 조사 금지", "30cm 이내 근접 금지", "동일 부위 10분 초과 금지"],
    checklist: ["렌즈 청소", "30cm 거리", "눈 가림", "타이머 10분"]
  }
];

export const NOTICES = [
  { date: "10-02", text: "키오스크 이용 교육 콘텐츠가 개편되었습니다." },
  { date: "09-25", text: "저주파 패드 소모품 교체 주기 안내 (3개월)." },
  { date: "09-10", text: "추석 연휴 휴무 안내 (10/3~10/5)." }
];

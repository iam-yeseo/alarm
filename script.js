(function () {
  "use strict";

  var STORAGE_KEY = "myeottoeya-settings-v1";
  var RING_CIRCUMFERENCE = 2 * Math.PI * 96;

  var defaults = {
    startTime: "09:00",
    workHours: 9,
    workMinutes: 0,
    includeLunch: false,
    leave: "none", // none | am | pm | full
    salary: 0, // 세전 연봉(원)
    precisePercent: false
  };

  var settings = loadSettings();

  // --- Elements ---
  var $ = function (id) { return document.getElementById(id); };
  var tabStatus = $("tab-status");
  var tabSettings = $("tab-settings");
  var panelStatus = $("panel-status");
  var panelSettings = $("panel-settings");
  var ringFill = $("ringFill");
  var percentText = $("percentText");
  var percentLabel = $("percentLabel");
  var remainingLabel = $("remainingLabel");
  var remainingTime = $("remainingTime");
  var todayEarnedEl = $("todayEarned");
  var monthEarnedEl = $("monthEarned");
  var moneyHint = $("moneyHint");
  var startTimeInput = $("startTime");
  var endTimeEl = $("endTime");
  var basisNote = $("basisNote");
  var workHoursSel = $("workHours");
  var workMinutesSel = $("workMinutes");
  var includeLunchChk = $("includeLunch");
  var leaveButtons = Array.prototype.slice.call(document.querySelectorAll(".leave-btn"));
  var salaryInput = $("salaryInput");
  var dailyWageHint = $("dailyWageHint");
  var precisePercentChk = $("precisepercent");

  // --- Storage ---
  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, defaults);
      return Object.assign({}, defaults, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, defaults);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) { /* 저장 실패는 무시 */ }
  }

  // --- Date helpers ---
  function todayAt(timeStr) {
    var parts = timeStr.split(":");
    var d = new Date();
    d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    return d;
  }

  function isWeekend(date) {
    var day = date.getDay();
    return day === 0 || day === 6;
  }

  function weekdaysInMonth(date) {
    var year = date.getFullYear();
    var month = date.getMonth();
    var days = new Date(year, month + 1, 0).getDate();
    var count = 0;
    for (var i = 1; i <= days; i++) {
      var dow = new Date(year, month, i).getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }

  function pastWeekdaysThisMonth(date) {
    var year = date.getFullYear();
    var month = date.getMonth();
    var count = 0;
    for (var i = 1; i < date.getDate(); i++) {
      var dow = new Date(year, month, i).getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatKRW(amount) {
    return "₩" + Math.floor(amount).toLocaleString("ko-KR");
  }

  // --- Schedule ---
  // 오늘의 근무 구간(시작/종료)을 계산한다. 반차는 총 근무시간의 절반만 근무.
  function getSchedule(now) {
    var totalMinutes = settings.workHours * 60 + settings.workMinutes +
      (settings.includeLunch ? 60 : 0);
    var dayStart = todayAt(settings.startTime);
    var dayEnd = new Date(dayStart.getTime() + totalMinutes * 60000);
    var workStart = dayStart;
    var workEnd = dayEnd;

    if (settings.leave === "am") {
      workStart = new Date(dayStart.getTime() + (totalMinutes / 2) * 60000);
    } else if (settings.leave === "pm") {
      workEnd = new Date(dayStart.getTime() + (totalMinutes / 2) * 60000);
    }

    return {
      dayStart: dayStart,
      dayEnd: dayEnd,
      workStart: workStart,
      workEnd: workEnd,
      totalMinutes: totalMinutes,
      isDayOff: settings.leave === "full" || isWeekend(now)
    };
  }

  // 오늘 업무 진행률 0~1
  function getProgress(now, schedule) {
    if (schedule.isDayOff) return 1;
    var total = schedule.workEnd - schedule.workStart;
    if (total <= 0) return 1;
    var elapsed = now - schedule.workStart;
    return Math.min(1, Math.max(0, elapsed / total));
  }

  // --- Render: 현황 ---
  function render() {
    var now = new Date();
    var schedule = getSchedule(now);
    var progress = getProgress(now, schedule);

    // 원형 진행률
    ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
    var pct = progress * 100;
    percentText.textContent = settings.precisePercent
      ? pct.toFixed(2) + "%"
      : Math.floor(pct) + "%";

    // 남은 시간
    if (isWeekend(now)) {
      percentLabel.textContent = "오늘은 주말!";
      remainingLabel.textContent = "푹 쉬세요";
      remainingTime.textContent = "🛌 주말입니다";
    } else if (settings.leave === "full") {
      percentLabel.textContent = "오늘은 연차!";
      remainingLabel.textContent = "푹 쉬세요";
      remainingTime.textContent = "🌴 연차입니다";
    } else if (now >= schedule.workEnd) {
      percentLabel.textContent = "오늘 업무 진행률";
      remainingLabel.textContent = "퇴근 시간이 지났어요";
      remainingTime.textContent = "🎉 퇴근하세요!";
    } else {
      percentLabel.textContent = "오늘 업무 진행률";
      remainingLabel.textContent = now < schedule.workStart
        ? "업무 시작까지 남은 시간"
        : "퇴근까지 남은 시간";
      var target = now < schedule.workStart ? schedule.workStart : schedule.workEnd;
      var diff = Math.max(0, Math.floor((target - now) / 1000));
      var h = Math.floor(diff / 3600);
      var m = Math.floor((diff % 3600) / 60);
      var s = diff % 60;
      remainingTime.textContent = h + "시간 " + m + "분 " + s + "초";
    }

    renderMoney(now, progress);
  }

  // --- Render: 번 돈 ---
  function renderMoney(now, progress) {
    if (!settings.salary || settings.salary <= 0) {
      todayEarnedEl.textContent = "₩0";
      monthEarnedEl.textContent = "₩0";
      moneyHint.classList.remove("hidden");
      return;
    }
    moneyHint.classList.add("hidden");

    var totalWeekdays = weekdaysInMonth(now);
    var dailyWage = settings.salary / 12 / totalWeekdays;

    // 오늘 번 돈: 0원부터 근무 진행률에 따라 일당까지 누적 (연차는 유급이므로 전액)
    var todayEarned;
    if (isWeekend(now)) {
      todayEarned = 0;
    } else if (settings.leave === "full") {
      todayEarned = dailyWage;
    } else {
      todayEarned = dailyWage * progress;
    }

    // 이달 번 돈: 지나간 평일 일당 + 오늘 번 돈
    var monthEarned = dailyWage * pastWeekdaysThisMonth(now) + todayEarned;

    todayEarnedEl.textContent = formatKRW(todayEarned);
    monthEarnedEl.textContent = formatKRW(monthEarned);
  }

  // --- Render: 설정/고정 표시 ---
  function renderStatic() {
    var schedule = getSchedule(new Date());
    endTimeEl.textContent = pad(schedule.dayEnd.getHours()) + ":" + pad(schedule.dayEnd.getMinutes());

    var noteH = Math.floor(schedule.totalMinutes / 60);
    var noteM = schedule.totalMinutes % 60;
    var leaveNote = { none: "", am: " · 오전 반차", pm: " · 오후 반차", full: " · 연차" }[settings.leave];
    basisNote.textContent = "총 " + noteH + "시간 " + pad(noteM) + "분 기준으로 계산" + leaveNote;

    if (settings.salary > 0) {
      var dailyWage = settings.salary / 12 / weekdaysInMonth(new Date());
      dailyWageHint.textContent = "이번 달 기준 일당은 약 " + formatKRW(dailyWage) + "입니다.";
    } else {
      dailyWageHint.textContent = "연봉 ÷ 12 ÷ 이번 달 평일 수로 일당을 계산합니다.";
    }
  }

  // --- Settings UI 초기화 ---
  function initSettingsUI() {
    for (var i = 1; i <= 12; i++) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      workHoursSel.appendChild(opt);
    }

    startTimeInput.value = settings.startTime;
    workHoursSel.value = String(settings.workHours);
    workMinutesSel.value = String(settings.workMinutes);
    includeLunchChk.checked = settings.includeLunch;
    precisePercentChk.checked = settings.precisePercent;
    salaryInput.value = settings.salary > 0 ? settings.salary.toLocaleString("ko-KR") : "";
    setActiveLeave(settings.leave);
  }

  function setActiveLeave(leave) {
    leaveButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.leave === leave);
    });
  }

  function applyChange() {
    saveSettings();
    renderStatic();
    render();
  }

  // --- Events ---
  function switchTab(toSettings) {
    tabStatus.classList.toggle("active", !toSettings);
    tabSettings.classList.toggle("active", toSettings);
    tabStatus.setAttribute("aria-selected", String(!toSettings));
    tabSettings.setAttribute("aria-selected", String(toSettings));
    panelStatus.classList.toggle("active", !toSettings);
    panelSettings.classList.toggle("active", toSettings);
  }

  tabStatus.addEventListener("click", function () { switchTab(false); });
  tabSettings.addEventListener("click", function () { switchTab(true); });

  startTimeInput.addEventListener("change", function () {
    if (startTimeInput.value) {
      settings.startTime = startTimeInput.value;
      applyChange();
    }
  });

  workHoursSel.addEventListener("change", function () {
    settings.workHours = parseInt(workHoursSel.value, 10);
    applyChange();
  });

  workMinutesSel.addEventListener("change", function () {
    settings.workMinutes = parseInt(workMinutesSel.value, 10);
    applyChange();
  });

  includeLunchChk.addEventListener("change", function () {
    settings.includeLunch = includeLunchChk.checked;
    applyChange();
  });

  precisePercentChk.addEventListener("change", function () {
    settings.precisePercent = precisePercentChk.checked;
    applyChange();
  });

  leaveButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      settings.leave = btn.dataset.leave;
      setActiveLeave(settings.leave);
      applyChange();
    });
  });

  salaryInput.addEventListener("input", function () {
    var digits = salaryInput.value.replace(/[^0-9]/g, "");
    settings.salary = digits ? parseInt(digits, 10) : 0;
    salaryInput.value = digits ? Number(digits).toLocaleString("ko-KR") : "";
    applyChange();
  });

  // --- Start ---
  initSettingsUI();
  renderStatic();
  render();
  setInterval(render, 1000);
})();

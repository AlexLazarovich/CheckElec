// =============================
// Constants (הגדרות קבועות)
// =============================
const BASE_PRICE = 0.5425;            // מחיר התחלתי ליחידת צריכה
const TAX_RATE = 0.18;                // שיעור מס (18%)
const FINAL_PRICE = BASE_PRICE * (1 + TAX_RATE);  // מחיר סופי לאחר מס

// משתנה למעקב אחרי מספר המסלולים (יצירת מזהה ייחודי לכל מסלול)
let planCounter = 4; // 3 מסלולים כברירת מחדל; הבא יהיה 4

// =============================
// פונקציות כלליות
// =============================
function parseDateTime(dateString, timeString) {
  const [day, month, year] = dateString.split("/").map(Number);
  const [hour, minute] = timeString.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function clearResults() {
  const results = document.getElementById("results");
  results.innerHTML = "";
  results.style.display = "none";
}

// =============================
// משתנה גלובלי לשמירת שורות CSV תקינות
// =============================
let validRows = [];

// =============================
// ניהול מצב עריכת מסלולים (רק מסלול אחד בעריכה בכל זמן נתון)
// =============================
let currentEditingDiv = null;
function closeAllEditingPlans() {
  document.querySelectorAll(".planRow").forEach(div => {
    if (div.querySelector(".savePlanButton")) {
      div.querySelector(".savePlanButton").click();
    }
  });
}

// =============================
// העלאת קובץ CSV והגדרת טווח תאריכים
// =============================
document.getElementById("csvFileInput").addEventListener("change", function(e) {
  // Whenever the user re‑uploads a CSV, hide the help section:
  const helpSection = document.getElementById("helpSection");
  const toggleHelpButton = document.getElementById("toggleHelpButton");
  if (helpSection) {
    helpSection.style.display = "none";
    // reset any open step
    document.querySelectorAll(".help-step.open")
      .forEach(s => s.classList.remove("open"));
  }
  if (toggleHelpButton) {
    toggleHelpButton.style.display = "inline-block";
  }
  
  // Clear existing results when reuploading file.
  clearResults();
  
  const file = e.target.files[0];
  if (!file) return;
  
  Papa.parse(file, {
    complete: function(results) {
      let data = results.data;
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      let validStartIndex = 0;
      for (let i = 0; i < data.length; i++) {
        let candidate = data[i][0] ? data[i][0].trim().replace(/"/g, "") : "";
        if (candidate.match(dateRegex)) {
          validStartIndex = i;
          break;
        }
      }
      validRows = [];
      for (let i = validStartIndex; i < data.length; i++) {
        let row = data[i];
        if (row.length < 3) continue;
        let dateStr = row[0].trim().replace(/"/g, "");
        let timeStr = row[1].trim().replace(/"/g, "");
        let consumption = parseFloat(row[2].trim());
        if (isNaN(consumption)) continue;
        let dt = parseDateTime(dateStr, timeStr);
        validRows.push({ dt, consumption });
      }
      if (validRows.length === 0) {
        document.getElementById("results").innerText = "לא נמצאו שורות תקינות בקובץ ה-CSV.";
        return;
      }
      let minDate = validRows[0].dt;
      let maxDate = validRows[0].dt;
      validRows.forEach(item => {
        if (item.dt < minDate) minDate = item.dt;
        if (item.dt > maxDate) maxDate = item.dt;
      });
      function toDateInputValue(date) {
        let year = date.getFullYear();
        let month = (date.getMonth() + 1).toString().padStart(2, '0');
        let day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      const minDateString = toDateInputValue(minDate);
      const maxDateString = toDateInputValue(maxDate);
      const startDateInput = document.getElementById("startDateInput");
      const endDateInput = document.getElementById("endDateInput");
      startDateInput.setAttribute("min", minDateString);
      startDateInput.setAttribute("max", maxDateString);
      startDateInput.value = minDateString;
      endDateInput.setAttribute("min", minDateString);
      endDateInput.setAttribute("max", maxDateString);
      endDateInput.value = maxDateString;
      
      // Save default values
      startDateInput.dataset.default = minDateString;
      endDateInput.dataset.default = maxDateString;
      
      document.getElementById("toggleDateButton").style.display = "block";
      document.getElementById("plansSection").style.display = "block";
      loadDefaultPlans();
      document.getElementById("applyFilterButton").style.display = "block";
    },
    error: function(err) {
      document.getElementById("results").innerText = "שגיאה בפענוח קובץ CSV: " + err;
    }
  });
});

// =============================
// ניהול טווח תאריכים
// =============================
const toggleDateButton = document.getElementById("toggleDateButton");
const filterSection = document.getElementById("filterSection");
const closeFilterButton = document.getElementById("closeFilterButton");
const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");

toggleDateButton.addEventListener("click", function() {
  closeAllEditingPlans();
  filterSection.style.display = "block";
  toggleDateButton.style.display = "none"; // ensure it remains centered by not altering its container width
});

function updateFilterButtonText() {
  if (startDateInput.value !== startDateInput.dataset.default || endDateInput.value !== endDateInput.dataset.default) {
    closeFilterButton.innerText = "שמור";
  } else {
    closeFilterButton.innerText = "ביטול";
  }
}

startDateInput.addEventListener("change", function() {
  updateFilterButtonText();
  clearResults();
});
endDateInput.addEventListener("change", function() {
  updateFilterButtonText();
  clearResults();
});

closeFilterButton.addEventListener("click", function() {
  if (closeFilterButton.innerText === "שמור") {
    startDateInput.dataset.default = startDateInput.value;
    endDateInput.dataset.default = endDateInput.value;
  }
  filterSection.style.display = "none";
  toggleDateButton.style.display = "block";
});

// =============================
// ניהול מסלולים
// =============================
function renderPlanRow(div, editing) {
  if (editing && currentEditingDiv && currentEditingDiv !== div) {
    const saveBtn = currentEditingDiv.querySelector(".savePlanButton");
    if (saveBtn) saveBtn.click();
  }
  currentEditingDiv = editing ? div : null;
  
  let plan = JSON.parse(div.dataset.plan);
  if (!editing) {
    let displayHTML = `<div class="planInfo">
      <strong>${plan.name}</strong>&emsp;${plan.discount}%&emsp;`;
    if (plan.alwaysApply) {
      displayHTML += `24/7`;
    } else {
      displayHTML += `${plan.startTime} → ${plan.endTime}`;
    }
    displayHTML += `</div>`;
    displayHTML += `<div class="planActions">
      <button class="btn editPlanButton">ערוך</button>
      <button class="btn removePlanButton">הסר</button>
    </div>`;
    div.innerHTML = displayHTML;
    div.querySelector(".editPlanButton").addEventListener("click", function() {
      renderPlanRow(div, true);
      clearResults();
    });
    div.querySelector(".removePlanButton").addEventListener("click", function() {
      div.remove();
      clearResults();
    });
  } else {
    let defaultPlaceholder = div.dataset.defaultName || ("מסלול " + planCounter);
    let editHTML = `<div class="planEdit">
      <input type="text" class="planNameInput" placeholder="${defaultPlaceholder}" value="${plan.name}" onfocus="if(this.value===this.getAttribute('placeholder')){this.value=''; this.classList.add('active');}" onblur="if(this.value.trim()===''){this.value=this.getAttribute('placeholder'); this.classList.remove('active');}">
      <span class="discount-container">
        <input type="number" class="planDiscountInput" value="${plan.discount}" min="0" step="1">
        <span class="discount-sign">%</span>
      </span>
      <label><input type="checkbox" class="planAlwaysInput" ${plan.alwaysApply ? "checked" : ""}> 24/7</label>
      <span class="timeFieldsInput" style="${plan.alwaysApply ? 'display:none;' : 'display:inline-flex; align-items:center;'}">
        <input type="time" class="planStartInput" value="${plan.startTime}">
        <span class="arrow">→</span>
        <input type="time" class="planEndInput" value="${plan.endTime}">
      </span>
    </div>`;
    editHTML += `<div class="planActions">
      <button class="btn savePlanButton">שמור</button>
      <button class="btn cancelPlanButton">ביטול</button>
    </div>`;
    div.innerHTML = editHTML;
    
    div.querySelectorAll("input").forEach(input => {
      input.addEventListener("change", clearResults);
    });
    
    const alwaysCheckbox = div.querySelector(".planAlwaysInput");
    alwaysCheckbox.addEventListener("change", function() {
      const timeFields = div.querySelector(".timeFieldsInput");
      timeFields.style.display = this.checked ? "none" : "inline-flex";
    });
    
    const discountInput = div.querySelector(".planDiscountInput");
    const discountSign = div.querySelector(".discount-sign");
    discountInput.addEventListener("focus", function() {
      discountSign.style.display = "none";
    });
    discountInput.addEventListener("blur", function() {
      discountSign.style.display = discountInput.value ? "inline" : "none";
    });
    
    div.querySelector(".savePlanButton").addEventListener("click", function() {
      let enteredName = div.querySelector(".planNameInput").value;
      if (enteredName.trim() === "") {
        enteredName = div.querySelector(".planNameInput").getAttribute("placeholder");
      }
      plan.name = enteredName;
      plan.alwaysApply = div.querySelector(".planAlwaysInput").checked;
      if (!plan.alwaysApply) {
        plan.startTime = div.querySelector(".planStartInput").value;
        plan.endTime = div.querySelector(".planEndInput").value;
        if (!plan.startTime || !plan.endTime) {
          plan.alwaysApply = true;
        }
      }
      plan.discount = parseFloat(div.querySelector(".planDiscountInput").value);
      div.dataset.plan = JSON.stringify(plan);
      renderPlanRow(div, false);
      clearResults();
      currentEditingDiv = null;
    });
    
    div.querySelector(".cancelPlanButton").addEventListener("click", function() {
      renderPlanRow(div, false);
      clearResults();
      currentEditingDiv = null;
    });
  }
}

function addPlanRow(plan) {
  closeAllEditingPlans();
  if (!plan) {
    plan = { id: planCounter, name: "מסלול " + planCounter, alwaysApply: true, discount: 15, startTime: "", endTime: "" };
    plan.defaultName = "מסלול " + planCounter;
    planCounter++;
  }
  const plansList = document.getElementById("plansList");
  const div = document.createElement("div");
  div.className = "planRow";
  div.dataset.defaultName = plan.defaultName || plan.name;
  div.dataset.plan = JSON.stringify(plan);
  renderPlanRow(div, false);
  plansList.appendChild(div);
  clearResults();
}

function loadDefaultPlans() {
  document.getElementById("plansList").innerHTML = "";
  addPlanRow({ id: 1, name: "מסלול 1", alwaysApply: true, discount: 6, startTime: "", endTime: "" });
  addPlanRow({ id: 2, name: "מסלול 2", alwaysApply: false, startTime: "07:00", endTime: "17:00", discount: 15 });
  addPlanRow({ id: 3, name: "מסלול 3", alwaysApply: false, startTime: "23:00", endTime: "07:00", discount: 20 });
  planCounter = 4;
}

document.getElementById("addPlanButton").addEventListener("click", function() {
  closeAllEditingPlans();
  addPlanRow();
});

// =============================
// חישוב תוצאות
// =============================
function qualifiesForPlan(dt, startTime, endTime) {
  const [sH, sM] = startTime.split(":").map(Number);
  const [eH, eM] = endTime.split(":").map(Number);
  const discountStart = sH * 60 + sM;
  const discountEnd = eH * 60 + eM;
  const measTime = dt.getHours() * 60 + dt.getMinutes();
  if (discountEnd > discountStart) {
    const latestAllowed = discountEnd - 15;
    return (measTime >= discountStart && measTime <= latestAllowed);
  } else {
    const latestAllowed = discountEnd - 15;
    return (measTime >= discountStart || measTime <= latestAllowed);
  }
}

function closeAllEditingPlans() {
  document.querySelectorAll(".planRow").forEach(div => {
    if (div.querySelector(".savePlanButton")) {
      div.querySelector(".savePlanButton").click();
    }
  });
}

function computeResults() {
  if (validRows.length === 0) return;
  
  closeAllEditingPlans();
  filterSection.style.display = "none";
  toggleDateButton.style.display = "block";
  
  const startDateInputVal = startDateInput.value;
  const endDateInputVal = endDateInput.value;
  if (!startDateInputVal || !endDateInputVal) return;
  
  let startDate = new Date(startDateInputVal);
  let endDate = new Date(endDateInputVal);
  let endDatePlus = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
  
  const planDivs = document.querySelectorAll("#plansList .planRow");
  let plans = [];
  planDivs.forEach(div => {
    plans.push(JSON.parse(div.dataset.plan));
  });
  
  let totals = {};
  plans.forEach(plan => { totals[plan.id] = { name: plan.name, cost: 0 }; });
  
  validRows.forEach(item => {
    if (item.dt >= startDate && item.dt < endDatePlus) {
      plans.forEach(plan => {
        let cost;
        if (plan.alwaysApply) {
          cost = item.consumption * FINAL_PRICE * (1 - (plan.discount / 100));
        } else {
          if (qualifiesForPlan(item.dt, plan.startTime, plan.endTime)) {
            cost = item.consumption * FINAL_PRICE * (1 - (plan.discount / 100));
          } else {
            cost = item.consumption * FINAL_PRICE;
          }
        }
        totals[plan.id].cost += cost;
      });
    }
  });
  
  let sortedPlans = Object.keys(totals)
    .map(id => ({ id, name: totals[id].name, cost: totals[id].cost }))
    .sort((a, b) => a.cost - b.cost);
  
  let outputHTML = `<h2>תוצאות</h2>`;
  outputHTML += `<div class="results-dates" dir="ltr">
    <div class="date-box">${startDateInputVal}</div>
    <span class="arrow">→</span>
    <div class="date-box">${endDateInputVal}</div>
  </div>`;
  
  outputHTML += `<ul class="results-plans">`;
  sortedPlans.forEach((plan, index) => {
    if (index === 0) {
      outputHTML += `<li class="best-plan">${plan.name}: ${plan.cost.toFixed(2)} ₪</li>`;
    } else {
      outputHTML += `<li>${plan.name}: ${plan.cost.toFixed(2)} ₪</li>`;
    }
  });
  outputHTML += `</ul>`;
  
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = outputHTML;
  resultsDiv.style.display = "block";
}

document.getElementById("applyFilterButton").addEventListener("click", computeResults);

// =============================
// Toggle Help Section
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const toggleHelpButton = document.getElementById("toggleHelpButton");
  const helpSection = document.getElementById("helpSection");
  const closeHelpButton = document.getElementById("closeHelpButton");

  // Show help box
  toggleHelpButton.addEventListener("click", () => {
    helpSection.style.display = "block";
    toggleHelpButton.style.display = "none";
  });

  // Close help box
  closeHelpButton.addEventListener("click", () => {
    helpSection.style.display = "none";
    toggleHelpButton.style.display = "inline-block";
    // close any open step
    document.querySelectorAll(".help-step.open").forEach(s => s.classList.remove("open"));
  });

  // Accordion: step headers
  document.querySelectorAll(".help-step-header").forEach(header => {
    header.addEventListener("click", () => {
      const step = header.closest(".help-step");
      // close others
      document.querySelectorAll(".help-step.open").forEach(s => {
        if (s !== step) s.classList.remove("open");
      });
      // toggle this one
      step.classList.toggle("open");
    });
  });
});




// Clear results on any input change.
document.querySelectorAll("input").forEach(input => {
  input.addEventListener("input", clearResults);
});

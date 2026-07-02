const quickInputs = document.querySelectorAll("[data-quick-input]");

quickInputs.forEach((input) => {
  input.addEventListener("focus", () => {
    const strip = document.querySelector("[data-confirm-strip]");
    if (strip) {
      strip.style.display = "flex";
    }
  });
});

document.querySelectorAll("[data-choice]").forEach((button) => {
  button.addEventListener("click", () => {
    const group = button.closest(".choice-row");
    if (!group) return;

    group.querySelectorAll("[data-choice]").forEach((item) => {
      item.classList.remove("primary");
    });
    button.classList.add("primary");
    button.textContent = button.dataset.choice;
  });
});

document.querySelectorAll("[data-close-confirm]").forEach((button) => {
  button.addEventListener("click", () => {
    const strip = document.querySelector("[data-confirm-strip]");
    if (strip) {
      strip.style.display = "none";
    }
  });
});

document.querySelectorAll("[data-view-switch]").forEach((button) => {
  button.addEventListener("click", () => {
    const viewName = button.dataset.viewSwitch;
    const group = button.closest("[data-view-group]");
    if (!viewName || !group) return;

    group.querySelectorAll("[data-view-switch]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    document.querySelectorAll("[data-view-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.viewPane !== viewName;
    });
  });
});

document.querySelectorAll("[data-payment-status]").forEach((button) => {
  button.addEventListener("click", () => {
    const row = button.closest("[data-payment-row]");
    const status = button.dataset.paymentStatus;
    const chip = row?.querySelector("[data-payment-chip]");
    if (!row || !status || !chip) return;

    row.querySelectorAll("[data-payment-status]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    row.classList.remove("done", "cancelled");
    chip.className = "chip";

    if (status === "완료") {
      row.classList.add("done");
      chip.classList.add("green");
    } else if (status === "취소") {
      row.classList.add("cancelled");
      chip.classList.add("red");
    } else {
      chip.classList.add("amber");
    }

    chip.textContent = status;
  });
});

document.querySelectorAll("[data-note-file]").forEach((input) => {
  input.addEventListener("change", () => {
    const label = document.querySelector("[data-note-file-name]");
    const file = input.files?.[0];
    if (label && file) {
      label.textContent = `${file.name} 선택됨 · Action 추출 대기열에 추가할 수 있습니다.`;
    }
  });
});

document.querySelectorAll("[data-action-status]").forEach((button) => {
  button.addEventListener("click", () => {
    const row = button.closest("[data-action-row]");
    const status = button.dataset.actionStatus;
    const chip = row?.querySelector("[data-action-chip]");
    if (!row || !status || !chip) return;

    row.querySelectorAll("[data-action-status]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    row.classList.remove("created", "ignored");
    chip.className = "chip";

    if (status === "Task 생성") {
      row.classList.add("created");
      chip.classList.add("green");
      chip.textContent = "Task 생성됨";
    } else if (status === "무시") {
      row.classList.add("ignored");
      chip.classList.add("red");
      chip.textContent = "무시됨";
    } else {
      chip.classList.add("amber");
      chip.textContent = "생성 대기";
    }
  });
});

function setupDropzoneLabels() {
  document.querySelectorAll(".calendar-shell").forEach((shell) => {
    const dayLabels = Array.from(shell.querySelectorAll(".cal-head"))
      .slice(1)
      .map((head) => head.textContent.trim().replace(/\s+/g, " "));

    let currentTime = "";
    let dayIndex = 0;

    Array.from(shell.children).forEach((node) => {
      if (node.classList.contains("cal-time")) {
        currentTime = node.textContent.trim();
        dayIndex = 0;
        return;
      }

      if (node.classList.contains("cal-cell")) {
        node.dataset.dropzone = "true";
        node.dataset.dropLabel = `${dayLabels[dayIndex] || "일정"} ${currentTime}`.trim();
        dayIndex += 1;
      }
    });
  });

  document.querySelectorAll(".all-week-grid").forEach((grid) => {
    const dayLabels = Array.from(grid.querySelectorAll(".week-head"))
      .slice(1)
      .map((head) => head.textContent.trim().replace(/\s+/g, " "));

    let currentMember = "";
    let dayIndex = 0;

    Array.from(grid.children).forEach((node) => {
      if (node.classList.contains("member-name")) {
        currentMember = node.textContent.trim();
        dayIndex = 0;
        return;
      }

      if (!node.classList.contains("week-head")) {
        node.dataset.dropzone = "true";
        node.dataset.dropLabel = `${currentMember} · ${dayLabels[dayIndex] || "일정"}`.trim();
        dayIndex += 1;
      }
    });
  });

  document.querySelectorAll(".month-day").forEach((day) => {
    const date = day.querySelector(".month-date")?.textContent.trim().replace(/\s+/g, " ");
    day.dataset.dropzone = "true";
    day.dataset.dropLabel = date ? `7월 ${date}` : "월간 일정";
  });

  document.querySelectorAll(".schedule-day").forEach((day) => {
    const date = day.querySelector(".schedule-date")?.textContent.trim().replace(/\s+/g, " ");
    day.dataset.dropzone = "true";
    day.dataset.dropLabel = date || "캘린더 일정";
  });

  document.querySelectorAll(".timeline-track").forEach((track) => {
    const owner = track.closest(".timeline-row")?.querySelector(".timeline-label strong")?.textContent.trim() || "가로 캘린더";
    const days = Array.from(track.closest(".horizontal-board")?.querySelectorAll(".timeline-day") || []);
    track.querySelectorAll(".timeline-cell").forEach((cell, index) => {
      const day = days[index]?.textContent.trim().replace(/\s+/g, " ") || `Day ${index + 1}`;
      cell.dataset.dropzone = "true";
      cell.dataset.timelineCell = "true";
      cell.dataset.dayIndex = String(index + 1);
      cell.dataset.dropLabel = `${owner} · ${day}`;
    });
  });
}

function setupDraggableCalendarItems() {
  const selectors = [
    ".calendar-shell .event",
    ".calendar-shell .milestone",
    ".all-week-grid .mini-event",
    ".month-grid .month-event",
    ".calendar-schedule .schedule-item",
    ".horizontal-board .timeline-bar",
  ].join(",");

  document.querySelectorAll(selectors).forEach((item, index) => {
    const itemText = item.textContent;
    if (
      itemText.includes("회사 캘린더")
      || itemText.includes("회사 일정")
      || itemText.includes("비공개 일정")
      || itemText.includes("자리비움")
    ) {
      return;
    }

    item.dataset.draggableItem = "true";
    item.dataset.dragId = item.dataset.dragId || `drag-item-${index}`;
    item.setAttribute("draggable", "true");

    item.addEventListener("dragstart", (event) => {
      item.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", item.dataset.dragId);
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("is-dragging");
      document.querySelectorAll(".is-drop-hover").forEach((zone) => {
        zone.classList.remove("is-drop-hover");
      });
    });
  });

  document.querySelectorAll("[data-dropzone]").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("is-drop-hover");
      event.dataTransfer.dropEffect = "move";
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("is-drop-hover");
    });

    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("is-drop-hover");

      const dragId = event.dataTransfer.getData("text/plain");
      const item = document.querySelector(`[data-drag-id="${dragId}"]`);

      if (!item || item === zone || item.contains(zone)) return;

      if (zone.dataset.timelineCell === "true") {
        const track = zone.closest(".timeline-track");
        const span = item.dataset.span || "1";
        const row = item.dataset.row || "2";
        item.style.gridColumn = `${zone.dataset.dayIndex} / span ${span}`;
        item.style.gridRow = row;
        track.appendChild(item);
      } else {
        zone.appendChild(item);
      }

      markMovedItem(item, zone.dataset.dropLabel || "변경된 일정");
      prependChangeLog(item, zone.dataset.dropLabel || "변경된 일정");
    });
  });
}

function markMovedItem(item, dropLabel) {
  item.classList.add("is-updated");
  item.setAttribute("aria-label", `${item.textContent.trim()} ${dropLabel}로 이동됨`);

  const meta = item.querySelector("[data-drag-meta]")
    || Array.from(item.querySelectorAll("span")).find((span) => {
      return !span.classList.contains("member-dot")
        && !span.classList.contains("inline-note")
        && !span.classList.contains("chip");
    });

  if (meta) {
    meta.textContent = `${dropLabel} · 반영됨`;
    return;
  }

  const note = document.createElement("span");
  note.className = item.classList.contains("month-event") ? "inline-note" : "drag-note";
  note.textContent = "반영됨";
  item.appendChild(note);
}

function prependChangeLog(item, dropLabel) {
  const scope = item.closest("[data-view-pane]") || document;
  const log = scope.querySelector("[data-change-log]") || document.querySelector("[data-change-log]");
  if (!log) return;

  const title = item.querySelector("strong")?.textContent.trim()
    || item.childNodes[0]?.textContent.trim()
    || "일정";

  const entry = document.createElement("div");
  entry.className = "log";
  entry.innerHTML = `<span class="dot"></span><p><strong>방금</strong><br>${title} 일정이 ${dropLabel}로 이동되어 반영됨</p>`;
  log.prepend(entry);
}

setupDropzoneLabels();
setupDraggableCalendarItems();

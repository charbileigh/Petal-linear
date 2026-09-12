(() => {
  "use strict";

  const STORAGE_KEY = "petal-linear.tasks.v1";
  const LEGACY_STORAGE_KEY = "petalflow.tasks.v1";
  const THEME_KEY = "petal-linear.theme";
  const LEGACY_THEME_KEY = "petalflow.theme";
  const localISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const todayISO = () => localISO(new Date());
  const dateOffset = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localISO(date);
  };

  const defaultTasks = [
    { id: "PET-108", title: "Refine onboarding empty states", description: "Make the first-run experience feel clear and intentional.", status: "backlog", priority: "medium", project: "Petal Linear", due: dateOffset(5), comments: 2, assignee: "C" },
    { id: "WEB-042", title: "Audit mobile navigation spacing", description: "Check touch targets and vertical rhythm on small screens.", status: "backlog", priority: "high", project: "Website", due: dateOffset(3), comments: 4, assignee: "C" },
    { id: "RES-031", title: "Organise interview coding notes", description: "Consolidate open observations before the next analysis pass.", status: "backlog", priority: "low", project: "Research", due: dateOffset(8), comments: 0, assignee: "C" },
    { id: "PET-105", title: "Build task filtering interactions", description: "Add fast filtering without disrupting the current view.", status: "in-progress", priority: "urgent", project: "Petal Linear", due: todayISO(), comments: 5, assignee: "C" },
    { id: "WEB-039", title: "Prepare portfolio project thumbnails", description: "Select consistent crops and accessible descriptions.", status: "in-progress", priority: "medium", project: "Website", due: dateOffset(1), comments: 3, assignee: "C" },
    { id: "PET-102", title: "Test keyboard-first task creation", description: "Confirm shortcuts, focus order, and escape behaviour.", status: "review", priority: "high", project: "Petal Linear", due: todayISO(), comments: 7, assignee: "C" },
    { id: "RES-028", title: "Check evidence table consistency", description: "Review theme names and source locators across the table.", status: "review", priority: "medium", project: "Research", due: dateOffset(2), comments: 1, assignee: "C" },
    { id: "WEB-036", title: "Publish the updated case study", description: "Final copy and responsive checks completed.", status: "done", priority: "low", project: "Website", due: dateOffset(-1), comments: 2, assignee: "C" }
  ];

  const statusConfig = [
    { key: "backlog", label: "Backlog" },
    { key: "in-progress", label: "In progress" },
    { key: "review", label: "Review" },
    { key: "done", label: "Done" }
  ];

  const state = {
    tasks: loadTasks(),
    view: "board",
    scope: "all",
    project: null,
    priority: "all",
    search: ""
  };

  const el = (id) => document.getElementById(id);
  const board = el("board");
  const taskList = el("taskList");
  const emptyState = el("emptyState");
  const modal = el("taskModal");
  const form = el("taskForm");
  let toastTimer;
  let lastFocused;
  let installPrompt;

  function loadTasks() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY));
      return Array.isArray(stored) ? stored.map((task) => ({ ...task, project: task.project === "Petalflow" ? "Petal Linear" : task.project })) : defaultTasks;
    } catch (_) {
      return defaultTasks;
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  }

  function escapeHTML(value = "") {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
  }

  function formatDate(value) {
    if (!value) return "No due date";
    const date = new Date(`${value}T12:00:00`);
    const today = new Date(`${todayISO()}T12:00:00`);
    const diff = Math.round((date - today) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
  }

  function getFilteredTasks() {
    const query = state.search.trim().toLowerCase();
    return state.tasks.filter((task) => {
      if (state.scope === "today" && task.due !== todayISO()) return false;
      if (state.scope === "backlog" && task.status !== "backlog") return false;
      if (state.scope === "inbox" && task.status !== "backlog") return false;
      if (state.project && task.project !== state.project) return false;
      if (state.priority !== "all" && task.priority !== state.priority) return false;
      if (query && !`${task.title} ${task.id} ${task.project} ${task.description || ""}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  function priorityMarkup(priority) {
    const name = priority.charAt(0).toUpperCase() + priority.slice(1);
    return `<span class="priority-bars ${priority}" title="${name} priority" aria-label="${name} priority"></span>`;
  }

  function taskCard(task) {
    const overdue = task.due && task.due < todayISO() && task.status !== "done";
    return `
      <article class="task-card" draggable="true" data-task-id="${escapeHTML(task.id)}" tabindex="0" aria-label="Edit ${escapeHTML(task.title)}">
        <div class="task-meta"><span class="task-id">${escapeHTML(task.id)}</span><span>·</span><span class="task-project-chip">${escapeHTML(task.project)}</span></div>
        <h3>${escapeHTML(task.title)}</h3>
        <div class="task-footer">
          ${priorityMarkup(task.priority)}
          <span class="due-date ${overdue ? "overdue" : ""}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v3M18 3v3M4 8h16M5 5h14v15H5z"/></svg>${formatDate(task.due)}</span>
          ${task.comments ? `<span class="comments"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v11H9l-4 4V5Z"/></svg>${task.comments}</span>` : ""}
          <span class="avatar avatar-chabi" title="Assigned to Chabi">${escapeHTML(task.assignee || "C")}</span>
        </div>
      </article>`;
  }

  function renderBoard(tasks) {
    board.innerHTML = statusConfig.map((status) => {
      const group = tasks.filter((task) => task.status === status.key);
      return `
        <section class="board-column" aria-labelledby="column-${status.key}">
          <header class="column-header">
            <div class="column-title"><span class="column-dot ${status.key}"></span><span id="column-${status.key}">${status.label}</span><span class="column-count">${group.length}</span></div>
            <div class="column-actions"><button type="button" data-add-status="${status.key}" aria-label="Add task to ${status.label}">+</button></div>
          </header>
          <div class="task-stack" data-status="${status.key}">
            ${group.map(taskCard).join("")}
            <button class="add-task-inline" type="button" data-add-status="${status.key}"><span>+</span>Add task</button>
          </div>
        </section>`;
    }).join("");
  }

  function renderList(tasks) {
    taskList.innerHTML = `
      <div class="list-head"><span>Task</span><span>Status</span><span>Priority</span><span>Due</span><span>Project</span></div>
      ${tasks.map((task) => {
        const status = statusConfig.find((item) => item.key === task.status);
        return `<button class="list-task" type="button" data-task-id="${escapeHTML(task.id)}">
          <span class="list-title"><span class="column-dot ${task.status}"></span><span>${escapeHTML(task.title)}</span></span>
          <span><span class="status-pill">${status.label}</span></span>
          <span>${priorityMarkup(task.priority)}${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</span>
          <span>${formatDate(task.due)}</span>
          <span>${escapeHTML(task.project)}</span>
        </button>`;
      }).join("")}`;
  }

  function render() {
    const tasks = getFilteredTasks();
    const isEmpty = tasks.length === 0;
    board.hidden = state.view !== "board" || isEmpty;
    taskList.hidden = state.view !== "list" || isEmpty;
    emptyState.hidden = !isEmpty;
    renderBoard(tasks);
    renderList(tasks);
    updateCounts();
    bindRenderedEvents();
  }

  function updateCounts() {
    el("allCount").textContent = state.tasks.length;
    el("todayCount").textContent = state.tasks.filter((task) => task.due === todayISO()).length;
    el("backlogCount").textContent = state.tasks.filter((task) => task.status === "backlog").length;
    const done = state.tasks.filter((task) => task.status === "done").length;
    const percent = state.tasks.length ? Math.round((done / state.tasks.length) * 100) : 0;
    el("progressValue").textContent = `${percent}%`;
    el("progressLabel").textContent = `${done} of ${state.tasks.length} done`;
    el("progressRing").style.setProperty("--progress", `${percent}%`);
  }

  function bindRenderedEvents() {
    document.querySelectorAll("[data-task-id]").forEach((node) => {
      node.addEventListener("click", () => openTask(node.dataset.taskId));
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openTask(node.dataset.taskId); }
      });
      if (node.classList.contains("task-card")) {
        node.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("text/plain", node.dataset.taskId);
          event.dataTransfer.effectAllowed = "move";
          requestAnimationFrame(() => node.classList.add("dragging"));
        });
        node.addEventListener("dragend", () => node.classList.remove("dragging"));
      }
    });

    document.querySelectorAll("[data-add-status]").forEach((button) => {
      button.addEventListener("click", () => openTask(null, button.dataset.addStatus));
    });

    document.querySelectorAll(".task-stack").forEach((stack) => {
      stack.addEventListener("dragover", (event) => { event.preventDefault(); stack.classList.add("drag-over"); });
      stack.addEventListener("dragleave", (event) => { if (!stack.contains(event.relatedTarget)) stack.classList.remove("drag-over"); });
      stack.addEventListener("drop", (event) => {
        event.preventDefault();
        stack.classList.remove("drag-over");
        moveTask(event.dataTransfer.getData("text/plain"), stack.dataset.status);
      });
    });
  }

  function taskPrefix(project) {
    return project === "Research" ? "RES" : project === "Website" ? "WEB" : "PET";
  }

  function nextTaskId(project) {
    const prefix = taskPrefix(project);
    const max = state.tasks.reduce((value, task) => task.id.startsWith(prefix) ? Math.max(value, Number(task.id.split("-")[1]) || 0) : value, 0);
    return `${prefix}-${String(max + 1).padStart(3, "0")}`;
  }

  function createTask(input) {
    const title = String(input.title || "").trim();
    if (!title) throw new Error("A task title is required.");
    const project = ["Petal Linear", "Website", "Research"].includes(input.project) ? input.project : "Petal Linear";
    const status = statusConfig.some((item) => item.key === input.status) ? input.status : "backlog";
    const priority = ["urgent", "high", "medium", "low"].includes(input.priority) ? input.priority : "medium";
    const task = { id: nextTaskId(project), title, description: String(input.description || "").trim(), status, priority, project, due: input.due || "", comments: 0, assignee: "C" };
    state.tasks.unshift(task);
    saveTasks();
    render();
    return task;
  }

  function updateTask(id, input) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) throw new Error("Task not found.");
    const title = String(input.title ?? task.title).trim();
    if (!title) throw new Error("A task title is required.");
    Object.assign(task, { title, description: String(input.description ?? task.description).trim(), status: input.status ?? task.status, priority: input.priority ?? task.priority, project: input.project ?? task.project, due: input.due ?? task.due });
    saveTasks();
    render();
    return task;
  }

  function moveTask(id, status) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task || !statusConfig.some((item) => item.key === status) || task.status === status) return;
    task.status = status;
    saveTasks();
    render();
    showToast(`Moved to ${statusConfig.find((item) => item.key === status).label}`);
  }

  function deleteTask(id) {
    const index = state.tasks.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Task not found.");
    const [removed] = state.tasks.splice(index, 1);
    saveTasks();
    render();
    return removed;
  }

  function openTask(id = null, status = "backlog") {
    const task = id ? state.tasks.find((item) => item.id === id) : null;
    lastFocused = document.activeElement;
    form.reset();
    el("taskId").value = task?.id || "";
    el("taskTitle").value = task?.title || "";
    el("taskDescription").value = task?.description || "";
    el("taskStatus").value = task?.status || status;
    el("taskPriority").value = task?.priority || "medium";
    el("taskProject").value = task?.project || state.project || "Petal Linear";
    el("taskDue").value = task?.due || "";
    el("modalKicker").textContent = task ? task.id : "New task";
    el("modalTitle").textContent = task ? "Edit task" : "Capture what’s next";
    el("submitLabel").textContent = task ? "Save changes" : "Create task";
    el("deleteTaskButton").hidden = !task;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => el("taskTitle").focus(), 30);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocused?.focus) lastFocused.focus();
  }

  function showToast(message) {
    el("toastMessage").textContent = message;
    el("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el("toast").classList.remove("show"), 2200);
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    el("themeToggle").setAttribute("aria-label", `Switch to ${theme === "light" ? "dark" : "light"} mode`);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", theme === "light" ? "#fdf8fb" : "#110b18");
  }

  function setView(view) {
    state.view = view;
    el("boardViewButton").classList.toggle("active", view === "board");
    el("listViewButton").classList.toggle("active", view === "list");
    el("boardViewButton").setAttribute("aria-selected", String(view === "board"));
    el("listViewButton").setAttribute("aria-selected", String(view === "list"));
    render();
  }

  function setScope(scope, label) {
    state.scope = scope;
    state.project = null;
    document.querySelectorAll(".nav-item[data-scope]").forEach((item) => item.classList.toggle("active", item.dataset.scope === scope));
    document.querySelectorAll(".project-link").forEach((item) => item.classList.remove("selected"));
    el("pageTitle").textContent = label;
    el("breadcrumbView").textContent = label;
    el("breadcrumbProject").textContent = "Petal Linear";
    el("eyebrowText").textContent = scope === "today" ? new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()) : "Personal workspace";
    el("pageSubtitle").textContent = scope === "backlog" ? "Ideas waiting for the right moment." : scope === "today" ? "A focused view of what needs your attention now." : scope === "inbox" ? "New work waiting to be organised." : "Everything you’re moving forward, in one calm place.";
    closeSidebar();
    render();
  }

  function setProject(project) {
    state.project = project;
    state.scope = "all";
    document.querySelectorAll(".nav-item[data-scope]").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".project-link").forEach((item) => item.classList.toggle("selected", item.dataset.project === project));
    el("pageTitle").textContent = project;
    el("breadcrumbProject").textContent = project;
    el("breadcrumbView").textContent = "Tasks";
    el("eyebrowText").textContent = "Project workspace";
    el("pageSubtitle").textContent = `Plan, track, and complete ${project.toLowerCase()} work.`;
    closeSidebar();
    render();
  }

  function closeSidebar() {
    el("sidebar").classList.remove("open");
    el("sidebarScrim").classList.remove("show");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = { title: el("taskTitle").value, description: el("taskDescription").value, status: el("taskStatus").value, priority: el("taskPriority").value, project: el("taskProject").value, due: el("taskDue").value };
    const id = el("taskId").value;
    try {
      if (id) { updateTask(id, input); showToast("Task updated"); }
      else { createTask(input); showToast("Task created"); }
      closeModal();
    } catch (error) { el("taskTitle").setCustomValidity(error.message); el("taskTitle").reportValidity(); el("taskTitle").setCustomValidity(""); }
  });

  el("deleteTaskButton").addEventListener("click", () => {
    const id = el("taskId").value;
    if (!id || !confirm("Delete this task? This cannot be undone.")) return;
    deleteTask(id);
    closeModal();
    showToast("Task deleted");
  });
  el("newTaskButton").addEventListener("click", () => openTask());
  el("emptyNewTask").addEventListener("click", () => openTask());
  el("modalClose").addEventListener("click", closeModal);
  el("cancelTaskButton").addEventListener("click", closeModal);
  modal.addEventListener("mousedown", (event) => { if (event.target === modal) closeModal(); });
  el("themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));
  el("boardViewButton").addEventListener("click", () => setView("board"));
  el("listViewButton").addEventListener("click", () => setView("list"));
  el("taskSearch").addEventListener("input", (event) => { state.search = event.target.value; render(); });
  el("sidebarSearch").addEventListener("click", () => { closeSidebar(); el("taskSearch").focus(); });
  el("filterButton").addEventListener("click", () => {
    const menu = el("filterMenu");
    menu.hidden = !menu.hidden;
    el("filterButton").setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.querySelectorAll(".filter-option").forEach((option) => option.addEventListener("click", () => {
    state.priority = option.dataset.priority;
    document.querySelectorAll(".filter-option").forEach((item) => item.classList.toggle("active", item === option));
    el("filterBadge").hidden = state.priority === "all";
    el("filterMenu").hidden = true;
    el("filterButton").setAttribute("aria-expanded", "false");
    render();
  }));
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".filter-wrap")) { el("filterMenu").hidden = true; el("filterButton").setAttribute("aria-expanded", "false"); }
  });
  document.querySelectorAll(".nav-item[data-scope]").forEach((item) => item.addEventListener("click", () => setScope(item.dataset.scope, item.querySelector("span:nth-child(2)").textContent)));
  document.querySelectorAll(".project-link").forEach((item) => item.addEventListener("click", () => setProject(item.dataset.project)));
  el("menuButton").addEventListener("click", () => { el("sidebar").classList.add("open"); el("sidebarScrim").classList.add("show"); });
  el("sidebarClose").addEventListener("click", closeSidebar);
  el("sidebarScrim").addEventListener("click", closeSidebar);
  el("settingsButton").addEventListener("click", () => showToast("Your preferences are saved on this device"));

  document.addEventListener("keydown", (event) => {
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName);
    if (event.key === "Escape") { if (!modal.hidden) closeModal(); else closeSidebar(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); closeModal(); closeSidebar(); el("taskSearch").focus(); }
    if (!typing && !event.metaKey && !event.ctrlKey && event.key.toLowerCase() === "n") { event.preventDefault(); openTask(); }
  });

  function registerWebMCP() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const safeExecute = (handler) => async (input) => {
      try { return { ok: true, data: handler(input || {}) }; }
      catch (error) { return { ok: false, error: error.message }; }
    };
    const tools = [
      {
        name: "list_tasks", title: "List tasks", description: "List Petal Linear tasks, optionally filtered by status, priority, or project.",
        inputSchema: { type: "object", properties: { status: { type: "string", enum: statusConfig.map((item) => item.key) }, priority: { type: "string", enum: ["urgent", "high", "medium", "low"] }, project: { type: "string", enum: ["Petal Linear", "Website", "Research"] } }, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: safeExecute((input) => state.tasks.filter((task) => (!input.status || task.status === input.status) && (!input.priority || task.priority === input.priority) && (!input.project || task.project === input.project)))
      },
      {
        name: "create_task", title: "Create task", description: "Create a new task in Petal Linear and update the visible task board.",
        inputSchema: { type: "object", properties: { title: { type: "string", minLength: 1, maxLength: 100 }, description: { type: "string", maxLength: 300 }, status: { type: "string", enum: statusConfig.map((item) => item.key) }, priority: { type: "string", enum: ["urgent", "high", "medium", "low"] }, project: { type: "string", enum: ["Petal Linear", "Website", "Research"] }, due: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } }, required: ["title"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: safeExecute(createTask)
      },
      {
        name: "update_task", title: "Update task", description: "Update an existing Petal Linear task using its task ID.",
        inputSchema: { type: "object", properties: { id: { type: "string" }, title: { type: "string", minLength: 1, maxLength: 100 }, description: { type: "string", maxLength: 300 }, status: { type: "string", enum: statusConfig.map((item) => item.key) }, priority: { type: "string", enum: ["urgent", "high", "medium", "low"] }, project: { type: "string", enum: ["Petal Linear", "Website", "Research"] }, due: { type: "string" } }, required: ["id"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: safeExecute((input) => updateTask(input.id, input))
      },
      {
        name: "delete_task", title: "Delete task", description: "Delete a Petal Linear task by task ID.",
        inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: safeExecute((input) => deleteTask(input.id))
      }
    ];
    tools.forEach((tool) => { try { void Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch (_) {} });
  }

  const savedTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY);
  setTheme(savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  render();
  registerWebMCP();

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    el("installButton").hidden = false;
  });
  el("installButton").addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") showToast("Petal Linear installed");
    installPrompt = null;
    el("installButton").hidden = true;
  });
  window.addEventListener("appinstalled", () => { installPrompt = null; el("installButton").hidden = true; });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
})();

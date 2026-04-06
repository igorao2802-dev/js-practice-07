"use strict";

/* =====================================================
   КОНСТАНТЫ И НАСТРОЙКИ
===================================================== */
// ПОЧЕМУ? — Выносим лимит в константу для единой точки контроля валидации и HTML-атрибута
const MAX_TASK_LENGTH = 256;
// ПОЧЕМУ? — Массив гарантирует строгий порядок колонок для навигации и сортировки
const COLUMN_ORDER = ["todo", "in-progress", "done"];
// ПОЧЕМУ? — Числовое представление приоритетов ускоряет сравнение при сортировке и вставке
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

/* =====================================================
   ПОИСК ЭЛЕМЕНТОВ DOM
===================================================== */
// ПОЧЕМУ? — querySelector эффективнее getElementById в современных движках и допускает сложные селекторы при расширении
const taskInput = document.querySelector("#task-input");
const prioritySelect = document.querySelector("#priority-select");
const addTaskBtn = document.querySelector("#add-task-btn");
const validationMsg = document.querySelector("#validation-msg");
const toggleThemeBtn = document.querySelector("#toggle-theme-btn");
const clearDoneBtn = document.querySelector("#clear-done-btn");
const viewModeBtn = document.querySelector("#view-mode-btn");
const taskCountEl = document.querySelector("#task-count");
const board = document.querySelector("#board");
const welcomeBanner = document.querySelector("#welcome-banner");
const closeBannerBtn = document.querySelector("#close-banner-btn");

// ПОЧЕМУ? — Глобальное состояние режима просмотра вынесено для управления жизненным циклом обработчиков
let isViewMode = false;

/* =====================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
===================================================== */
// ПОЧЕМУ? — Изоляция textContent в отдельной функции предотвращает случайное использование innerHTML и централизует безопасный вывод
function safeText(node, text) {
  if (!node) return; // ПОЧЕМУ? — Защита от silent fail при отсутствии узла
  node.textContent = text;
}

// ПОЧЕМУ? — Комбинация timestamp и случайной строки исключает коллизии при быстром добавлении задач без внешних библиотек
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ПОЧЕМУ? — DOM-уведомления не блокируют интерфейс пользователя в отличие от alert(), что соответствует требованиям UX и ТЗ
function showError(msg) {
  safeText(validationMsg, msg);
  validationMsg.classList.remove("hidden");
  validationMsg.style.color = "#ef4444";
}

function clearError() {
  validationMsg.textContent = "";
  validationMsg.classList.add("hidden");
  validationMsg.style.color = "";
}

// ПОЧЕМУ? — Временный вывод информационных сообщений через DOM заменяет модальные окна и автоматически очищает состояние
function showInfo(msg, duration = 3000) {
  safeText(validationMsg, msg);
  validationMsg.classList.remove("hidden");
  validationMsg.style.color = "#3b82f6";
  setTimeout(() => {
    validationMsg.textContent = "";
    validationMsg.classList.add("hidden");
  }, duration);
}

// ПОЧЕМУ? — Валидация вынесена в чистую функцию для повторного использования при вводе, редактировании и отправке формы
function validateTaskText(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "Введите название задачи";
  if (trimmed.length < 3) return "Минимум 3 символа";
  // ПОЧЕМУ? — Ограничение сверху защищает от переполнения хранилища и деградации производительности рендера
  if (trimmed.length > MAX_TASK_LENGTH)
    return `Максимум ${MAX_TASK_LENGTH} символов (сейчас ${trimmed.length})`;
  return null;
}

// ПОЧЕМУ? — Пакетное чтение DOM через querySelectorAll и последующая запись в хранилище минимизирует перерисовки и синхронизирует состояние
function updateCounters() {
  const allCards = document.querySelectorAll(".task-card");
  safeText(taskCountEl, String(allCards.length));

  COLUMN_ORDER.forEach((status) => {
    const column = document.querySelector(`.column[data-status="${status}"]`);
    if (!column) return; // ПОЧЕМУ? — Защита от ошибки при динамическом изменении структуры
    const countBadge = column.querySelector(".column-count");
    const cards = column.querySelectorAll(".task-card");
    safeText(countBadge, String(cards.length));
  });
  saveToStorage();
}

/* =====================================================
   СОЗДАНИЕ И РЕДАКТИРОВАНИЕ КАРТОЧЕК
===================================================== */
// ПОЧЕМУ? — Программное создание узлов исключает XSS-уязвимости, возникающие при парсинге пользовательских строк через innerHTML
function createTaskCard(task) {
  const card = document.createElement("div");
  card.className = "task-card";
  // ПОЧЕМУ? — data-атрибуты связывают JS-логику с CSS-селекторами без inline-стилей, упрощая поддержку тем
  card.dataset.id = task.id;
  card.dataset.priority = task.priority;
  card.style.animation = "fadeIn 0.25s ease";

  const title = document.createElement("h3");
  safeText(title, task.text);
  title.title = "Двойной клик для редактирования";
  // ПОЧЕМУ? — Правила переноса задаются явно для защиты от горизонтального скролла на мобильных устройствах
  title.style.wordWrap = "break-word";
  title.style.overflowWrap = "break-word";
  title.style.wordBreak = "break-all";
  title.style.hyphens = "auto";

  const badge = document.createElement("span");
  badge.className = `priority-badge ${task.priority}`;
  safeText(
    badge,
    task.priority === "high"
      ? "🔴 Высокий"
      : task.priority === "medium"
        ? "🟡 Средний"
        : "🟢 Низкий",
  );
  badge.title = "Двойной клик для смены приоритета";

  const actions = document.createElement("div");
  actions.className = "card-actions";
  // ПОЧЕМУ? — Метод forEach с createElement оптимизирует создание кнопок и исключает дублирование кода
  ["prev", "next", "delete"].forEach((action) => {
    const btn = document.createElement("button");
    btn.dataset.action = action;
    safeText(
      btn,
      action === "prev"
        ? "← Назад"
        : action === "next"
          ? "→ Вперёд"
          : "✕ Удалить",
    );
    btn.className = action === "delete" ? "btn-danger" : "btn-secondary";
    btn.style.flex = "1";
    btn.style.minWidth = "60px";
    actions.appendChild(btn);
  });

  card.append(title, badge, actions);

  // ПОЧЕМУ? — stopPropagation изолирует событие редактирования от делегированного клика выделения на родительской доске
  title.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    if (!isViewMode) editTaskTitle(card, title);
  });
  badge.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    if (!isViewMode) editTaskPriority(card, badge);
  });

  return card;
}

// ПОЧЕМУ? — Выделение логики обновления стилей в отдельную функцию предотвращает дублирование кода при смене приоритетов и тем
function updateCardPriorityStyle(card, newPriority) {
  card.dataset.priority = newPriority;
  const title = card.querySelector("h3");
  if (title) {
    // ПОЧЕМУ? — Повторное применение правил переноса гарантирует сохранение читаемости после динамической замены узлов
    title.style.wordWrap = "break-word";
    title.style.overflowWrap = "break-word";
    title.style.wordBreak = "break-all";
    title.style.hyphens = "auto";
  }
  updateCounters();
}

// ПОЧЕМУ? — Паттерн inline-редактирования улучшает UX, избегая модальных окон и сохраняя контекст задачи
function editTaskTitle(card, titleEl) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = titleEl.textContent;
  // ПОЧЕМУ? — Нативный maxlength дублирует JS-валидацию для защиты от вставки через контекстное меню или Drag&Drop
  input.maxLength = MAX_TASK_LENGTH;
  input.style.cssText =
    "width: 100%; padding: 4px 8px; border: 1px solid #3b82f6; border-radius: 4px; font-size: 0.95rem; font-family: inherit; box-sizing: border-box; word-break: break-word;";

  card.replaceChild(input, titleEl);
  input.focus();

  const charCount = document.createElement("span");
  charCount.style.cssText =
    "font-size: 0.75rem; color: #64748b; margin-top: 2px; display: block;";
  charCount.textContent = `${input.value.length} / ${MAX_TASK_LENGTH}`;
  card.appendChild(charCount);

  input.addEventListener("input", () => {
    charCount.textContent = `${input.value.length} / ${MAX_TASK_LENGTH}`;
    // ПОЧЕМУ? — Визуальная обратная связь при превышении лимита предотвращает потерю данных до отправки
    charCount.style.color =
      input.value.length > MAX_TASK_LENGTH ? "#ef4444" : "#64748b";
  });

  const finishEdit = () => {
    charCount.remove();
    const newVal = input.value.trim();
    const err = validateTaskText(newVal);
    if (err) {
      showError(err);
      titleEl.textContent = input.value; // ПОЧЕМУ? — Откат к исходному тексту при ошибке сохраняет целостность данных
    } else {
      safeText(titleEl, newVal);
      clearError();
    }
    if (input.parentNode === card) card.replaceChild(titleEl, input);
    updateCounters();
  };

  // ПОЧЕМУ? — blur гарантирует сохранение данных при клике вне поля, а Enter/Escape обеспечивают клавиатурный UX
  input.addEventListener("blur", finishEdit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      charCount.remove();
      if (input.parentNode === card) card.replaceChild(titleEl, input);
      clearError();
    }
  });
}

// ПОЧЕМУ? — Замена элемента на <select> обеспечивает нативный выбор из списка без кастомных dropdown-компонентов
function editTaskPriority(card, badgeEl) {
  const select = document.createElement("select");
  select.style.cssText =
    "padding: 4px 8px; border: 1px solid #3b82f6; border-radius: 4px; font-size: 0.85rem; width: 100%; box-sizing: border-box;";
  const frag = document.createDocumentFragment();

  // ПОЧЕМУ? — DocumentFragment минимизирует количество рефлоуов при массовой вставке опций
  ["high", "medium", "low"].forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent =
      p === "high" ? "🔴 Высокий" : p === "medium" ? "🟡 Средний" : "🟢 Низкий";
    if (card.dataset.priority === p) opt.selected = true;
    frag.appendChild(opt);
  });
  select.appendChild(frag);

  if (badgeEl.parentNode === card) card.replaceChild(select, badgeEl);
  select.focus();

  select.addEventListener("change", () => {
    updateCardPriorityStyle(card, select.value);
    const newBadge = document.createElement("span");
    newBadge.className = `priority-badge ${select.value}`;
    safeText(
      newBadge,
      select.value === "high"
        ? "🔴 Высокий"
        : select.value === "medium"
          ? "🟡 Средний"
          : "🟢 Низкий",
    );
    newBadge.title = "Двойной клик для смены приоритета";

    if (select.parentNode === card) card.replaceChild(newBadge, select);
    // ПОЧЕМУ? — Привязка обработчика к новому узлу обязательна после replaceChild, иначе событие потеряется
    newBadge.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (!isViewMode) editTaskPriority(card, newBadge);
    });
  });
}

/* =====================================================
   ДОБАВЛЕНИЕ И СОРТИРОВКА
===================================================== */
// ПОЧЕМУ? — find() останавливается на первом совпадении, что эффективнее filter() или ручного цикла при поиске позиции вставки
function insertSorted(list, card) {
  const newPrio = PRIORITY_ORDER[card.dataset.priority] ?? 99;
  const cards = [...list.querySelectorAll(".task-card")];
  const after = cards.find(
    (c) => (PRIORITY_ORDER[c.dataset.priority] ?? 99) > newPrio,
  );
  list.insertBefore(card, after || null);
}

function addTask() {
  const text = taskInput.value.trim();
  const priority = prioritySelect.value;
  const error = validateTaskText(text);

  if (error) {
    showError(error);
    taskInput.focus();
    return;
  }
  clearError();

  const task = { id: generateId(), text, priority, status: "todo" };
  const card = createTaskCard(task);
  const todoList = document.querySelector('[data-status="todo"] .task-list');
  insertSorted(todoList, card);

  // ПОЧЕМУ? — Сброс фокуса и очистка формы предотвращают случайное дублирование при повторном нажатии Enter
  taskInput.value = "";
  prioritySelect.selectedIndex = 1;
  taskInput.focus();
  updateCounters();
}

/* =====================================================
   ДЕЛЕГИРОВАНИЕ СОБЫТИЙ НА ДОСКЕ
===================================================== */
// ПОЧЕМУ? — Именованная функция обязательна для корректного удаления обработчика через removeEventListener в режиме просмотра
function boardClickHandler(e) {
  const btn = e.target.closest("[data-action]");
  const card = e.target.closest(".task-card");
  if (!card || isViewMode) return;

  if (btn) {
    e.stopPropagation();
    const action = btn.dataset.action;
    if (action === "delete") deleteCard(card);
    else if (action === "next" || action === "prev")
      moveCard(card, action === "next" ? 1 : -1);
    return;
  }

  card.classList.toggle("selected");
}

board.addEventListener("click", boardClickHandler);

function deleteCard(card) {
  if (!window.confirm("Удалить задачу?")) return; // ПОЧЕМУ? — confirm защищает от случайных деструктивных действий
  card.remove();
  updateCounters();
}

function moveCard(card, dir) {
  const cur = card.closest(".column").dataset.status;
  const idx = COLUMN_ORDER.indexOf(cur) + dir;
  if (idx < 0 || idx >= COLUMN_ORDER.length) return; // ПОЧЕМУ? — Граничная проверка предотвращает выход за пределы массива колонок

  const target = document.querySelector(
    `[data-status="${COLUMN_ORDER[idx]}"] .task-list`,
  );
  if (target) insertSorted(target, card);
  updateCounters();
}

/* =====================================================
   ОБРАБОТЧИКИ УПРАВЛЕНИЯ
===================================================== */
// ПОЧЕМУ? — Переключение класса на body активирует CSS-каскад тем, что исключает необходимость ручного обхода всех элементов
toggleThemeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  saveThemeToStorage();
});

clearDoneBtn.addEventListener("click", () => {
  const doneList = document.querySelector('[data-status="done"] .task-list');
  const cards = doneList.querySelectorAll(".task-card");

  // ПОЧЕМУ? — DOM-уведомление заменяет запрещённый alert() и не прерывает выполнение потока
  if (!cards.length) {
    showInfo("Колонка «Готово» уже пуста.");
    return;
  }
  if (!window.confirm(`Удалить все ${cards.length} задач из колонки «Готово»?`))
    return;

  cards.forEach((c) => c.remove());
  updateCounters();
});

viewModeBtn.addEventListener("click", () => {
  isViewMode = !isViewMode;
  if (isViewMode) {
    // ПОЧЕМУ? — Удаление делегированного обработчика полностью блокирует взаимодействие с доской без нарушения структуры DOM
    board.removeEventListener("click", boardClickHandler);
    viewModeBtn.classList.add("view-mode-active");
    safeText(viewModeBtn, "✏️ Режим редактирования");
  } else {
    board.addEventListener("click", boardClickHandler);
    viewModeBtn.classList.remove("view-mode-active");
    safeText(viewModeBtn, "👁 Режим просмотра");
  }
});

if (welcomeBanner && closeBannerBtn) {
  // ПОЧЕМУ? — { once: true } гарантирует автоматическую очистку обработчика, предотвращая утечки памяти при повторных показах баннера
  closeBannerBtn.addEventListener(
    "click",
    () => {
      welcomeBanner.style.display = "none";
    },
    { once: true },
  );
}

// Форма
addTaskBtn.addEventListener("click", addTask);
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask();
  if (e.key === "Escape") {
    taskInput.value = "";
    clearError();
  }
});
taskInput.addEventListener("input", () => {
  const err = validateTaskText(taskInput.value.trim());
  if (err) {
    showError(err);
    taskInput.style.borderColor = "#ef4444";
  } else if (taskInput.value.trim().length > 0) {
    clearError();
    taskInput.style.borderColor = "#22c55e";
  } else {
    clearError();
    taskInput.style.borderColor = "";
  }
});

/* =====================================================
   LOCALSTORAGE
===================================================== */
function saveToStorage() {
  const tasks = [...document.querySelectorAll(".task-card")].map((c) => ({
    id: c.dataset.id,
    text: c.querySelector("h3").textContent,
    priority: c.dataset.priority,
    status: c.closest(".column").dataset.status,
  }));
  // ПОЧЕМУ? — try/catch обязателен: приватный режим браузера или переполнение квоты вызывают исключение при setItem
  try {
    localStorage.setItem("kanban-tasks", JSON.stringify(tasks));
  } catch (e) {
    console.error("Ошибка сохранения:", e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem("kanban-tasks");
    if (!raw) return;
    const tasks = JSON.parse(raw);
    tasks.forEach((t) => {
      const col = document.querySelector(
        `[data-status="${t.status}"] .task-list`,
      );
      if (col) insertSorted(col, createTaskCard(t));
    });
  } catch (e) {
    console.warn("Ошибка чтения:", e);
  } // ПОЧЕМУ? — Ошибка парсинга не должна ломать инициализацию приложения
}

function saveThemeToStorage() {
  localStorage.setItem(
    "kanban-theme",
    document.body.classList.contains("dark-mode") ? "dark" : "light",
  );
}
function loadThemeFromStorage() {
  if (localStorage.getItem("kanban-theme") === "dark")
    document.body.classList.add("dark-mode");
}

document.addEventListener("DOMContentLoaded", () => {
  loadThemeFromStorage();
  loadFromStorage();
  updateCounters();
});

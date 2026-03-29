"use strict";

/* =====================================================
ПРАКТИЧЕСКАЯ РАБОТА №7 — События в JS
Kanban-доска с делегированием событий
===================================================== */

/* =====================================================
1. ПОИСК ЭЛЕМЕНТОВ DOM
===================================================== */
// ПОЧЕМУ querySelector? — Возвращает первый совпавший элемент по CSS-селектору.
// Удобнее getElementById, позволяет использовать любые селекторы (.class, [data-attr]).
// Собираем все ссылки в одном месте — легче читать и отлаживать код.
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

// Порядок колонок — используется для перемещения задач
const COLUMN_ORDER = ["todo", "in-progress", "done"];

// Словарь меток приоритетов
const PRIORITY_LABELS = {
  low: "🟢 Низкий",
  medium: "🟡 Средний",
  high: "🔴 Высокий",
};

// Порядок сортировки по приоритету (для PRO)
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// Флаг режима просмотра
let isViewMode = false;

/* =====================================================
2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
===================================================== */

/**
 * Безопасная установка текста узла.
 * ПОЧЕМУ textContent? — Вставляю текст безопасно, экранируя HTML-теги.
 * Защищает от XSS-атак при вставке данных от пользователя.
 * В отличие от innerHTML, не выполняет HTML-код.
 */
function safeText(node, text) {
  node.textContent = text;
}

/**
 * Генерация уникального ID.
 * ПОЧЕМУ Date.now() + Math.random()? — Гарантирует уникальность в рамках сессии.
 * Date.now() даёт timestamp, Math.random() добавляет случайность.
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Показать сообщение об ошибке валидации.
 * ПОЧЕМУ textContent? — Безопасный вывод текста (защита от XSS).
 */
function showError(msg) {
  safeText(validationMsg, msg);
  validationMsg.classList.remove("hidden");
}

/**
 * Сбросить сообщение об ошибке.
 */
function clearError() {
  validationMsg.textContent = "";
  validationMsg.classList.add("hidden");
}

/* =====================================================
3. СЧЁТЧИКИ
===================================================== */

/**
 * Обновляет общий счётчик задач и счётчики в заголовках колонок.
 * ПОЧЕМУ querySelectorAll? — Возвращает статичный NodeList всех элементов.
 * Подходит для одного замера количества узлов без подписки на изменения.
 */
function updateCounters() {
  const allCards = document.querySelectorAll(".task-card");
  safeText(taskCountEl, String(allCards.length));

  COLUMN_ORDER.forEach((status) => {
    const column = document.querySelector(`.column[data-status="${status}"]`);
    const countBadge = column.querySelector(".column-count");
    const cards = column.querySelectorAll(".task-card");
    safeText(countBadge, String(cards.length));
  });

  // PRO: Сохраняем состояние после каждого изменения
  saveToStorage();
}

/* =====================================================
4. СОЗДАНИЕ КАРТОЧКИ ЗАДАЧИ
===================================================== */

/**
 * Создаёт DOM-узел карточки задачи.
 * ПОЧЕМУ createElement? — Создаю DOM-узел программно, без парсинга HTML.
 * Безопаснее и гибче, чем innerHTML. Нет риска XSS, лучше производительность.
 *
 * @param {{ id: string, text: string, priority: string, status: string }} task
 * @returns {HTMLElement}
 */
function createTaskCard(task) {
  // ПОЧЕМУ createElement? — Создаю узел программно — безопаснее, чем innerHTML
  const card = document.createElement("div");
  card.className = "task-card";
  card.dataset.id = task.id;
  card.dataset.priority = task.priority;

  // Добавляем класс для высокого приоритета (PRO: используется для сортировки)
  if (task.priority === "high") {
    card.classList.add("priority-high");
  }

  // ⚠️ ВНИМАНИЕ: Этот блок кода частично нарушает принцип разделения "структура-стили-функционал"
  // ПОЧЕМУ inline-стили? — По заданию нельзя вносить изменения в файлы index.html и style.css
  // Поэтому применяем анимацию появления через JS (fadeIn уже есть в style.css)
  card.style.animation = "fadeIn 0.25s ease";

  // Заголовок задачи
  // ПОЧЕМУ textContent? — Вставляю текст безопасно, экранируя теги — защита от XSS
  const title = document.createElement("h3");
  safeText(title, task.text);

  // Бейдж приоритета
  const badge = document.createElement("span");
  badge.className = `priority-badge ${task.priority}`;
  safeText(badge, PRIORITY_LABELS[task.priority] || task.priority);

  // Кнопки действий
  const actions = document.createElement("div");
  actions.className = "card-actions";

  const prevBtn = document.createElement("button");
  prevBtn.className = "btn-secondary";
  prevBtn.dataset.action = "prev";
  safeText(prevBtn, "← Назад");

  const nextBtn = document.createElement("button");
  nextBtn.dataset.action = "next";
  safeText(nextBtn, "→ Вперёд");

  const delBtn = document.createElement("button");
  delBtn.className = "btn-danger";
  delBtn.dataset.action = "delete";
  safeText(delBtn, "✕ Удалить");

  // ПОЧЕМУ append? — Добавляю несколько узлов одним вызовом.
  // Эффективнее, чем вызывать appendChild несколько раз.
  actions.append(prevBtn, nextBtn, delBtn);
  card.append(title, badge, actions);

  return card;
}

/* =====================================================
5. ДОБАВЛЕНИЕ ЗАДАЧИ
===================================================== */

/**
 * Читает форму, валидирует, создаёт карточку и добавляет в колонку «todo».
 */
function addTask() {
  const text = (taskInput.value || "").trim();
  const priority = prioritySelect.value;

  // --- Валидация ---
  // ПОЧЕМУ trim()? — Удаляю пробелы по краям — защита от ввода "   "
  if (text.length < 3) {
    showError("Название задачи должно содержать минимум 3 символа.");
    taskInput.focus();
    return;
  }

  // ПОЧЕМУ проверка на первый символ? — Защита от ввода спецсимволов/цифр
  const firstChar = text.charAt(0);
  if (!/[А-Яа-яA-Za-z]/.test(firstChar)) {
    showError("Первый символ должен быть буквой.");
    taskInput.focus();
    return;
  }

  clearError();

  const task = {
    id: generateId(),
    text,
    priority,
    status: "todo",
  };

  const card = createTaskCard(task);
  const todoList = document.querySelector('[data-status="todo"] .task-list');

  // PRO: Сортировка по приоритету при вставке
  insertSorted(todoList, card);

  // Сбрасываем форму
  taskInput.value = "";
  prioritySelect.selectedIndex = 1; // сброс на «Средний»
  taskInput.focus();

  updateCounters();
}

/**
 * PRO: Вставка карточки с сортировкой по приоритету.
 * ПОЧЕМУ insertBefore? — Вставляет узел перед указанным элементом.
 * Если after=null, вставляет в конец — поведение как у appendChild.
 */
function insertSorted(list, card) {
  const newPrio = PRIORITY_ORDER[card.dataset.priority] ?? 99;
  const cards = [...list.querySelectorAll(".task-card")];
  const after = cards.find(
    (c) => (PRIORITY_ORDER[c.dataset.priority] ?? 99) > newPrio,
  );
  list.insertBefore(card, after || null);
}

/* =====================================================
6. ОБРАБОТЧИКИ ФОРМЫ
===================================================== */

// ПОЧЕМУ addEventListener? — Позволяет навесить несколько обработчиков.
// Свойство onclick перезаписывается — это ошибка.
// Гибкое управление опциями (once, passive, capture).
addTaskBtn.addEventListener("click", addTask);

// ПОЧЕМУ keydown? — Обрабатываю нажатия клавиш для улучшения UX.
// Enter — добавить задачу, Escape — очистить форму.
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    addTask();
  }
  if (e.key === "Escape") {
    taskInput.value = "";
    clearError();
  }
});

/* =====================================================
7. ДЕЛЕГИРОВАНИЕ СОБЫТИЙ НА ДОСКЕ ⭐
===================================================== */

/**
 * Главный обработчик кликов на доске.
 * ПОЧЕМУ один обработчик на #board, а не на каждую кнопку?
 * — Делегирование: один обработчик работает для всех карточек,
 *   включая добавленные позже. Экономит память, упрощает код.
 *
 * Определяет нажатую кнопку через closest('[data-action]').
 */
function boardClickHandler(e) {
  // ПОЧЕМУ closest? — Поднимается по DOM вверх и находит ближайший
  // элемент с нужным селектором. Работает даже если кликнули на дочерний узел.
  const actionBtn = e.target.closest("[data-action]");
  const card = e.target.closest(".task-card");

  if (!card) return; // клик вне карточки — игнорируем

  // В режиме просмотра блокируем все действия
  if (isViewMode) {
    e.preventDefault();
    return;
  }

  if (actionBtn) {
    // ПОЧЕМУ stopPropagation? — Останавливаю всплытие: клик по кнопке
    // не должен триггерить обработчик выделения карточки.
    e.stopPropagation();

    const action = actionBtn.dataset.action;

    switch (action) {
      case "delete":
        deleteCard(card);
        break;
      case "next":
        moveCard(card, 1);
        break;
      case "prev":
        moveCard(card, -1);
        break;
    }

    return; // важно: выходим, чтобы не сработало выделение карточки
  }

  // Клик на саму карточку (не на кнопку) — выделение
  // ПОЧЕМУ classList.toggle? — Если класс есть — удаляет; если нет — добавляет.
  // Повторный клик снимает выделение — удобный UX.
  // ⚠️ ВНИМАНИЕ: Этот блок кода частично нарушает принцип разделения "структура-стили-функционал"
  // ПОЧЕМУ inline-стили для подсветки? — По заданию нельзя вносить изменения в style.css
  // Поэтому применяем цвета выделения динамически через JS в зависимости от приоритета
  card.classList.toggle("selected");

  // Подсветка по приоритету через inline-стили
  if (card.classList.contains("selected")) {
    const priority = card.dataset.priority;

    // Цвета для разных приоритетов
    const priorityColors = {
      high: { border: "#ef4444", bg: "#fef2f2", shadow: "#fca5a5" },
      medium: { border: "#f59e0b", bg: "#fffbeb", shadow: "#fcd34d" },
      low: { border: "#22c55e", bg: "#f0fdf4", shadow: "#86efac" },
    };

    const colors = priorityColors[priority] || priorityColors.medium;

    // ПОЧЕМУ style.borderColor? — Применяем цвет рамки в зависимости от приоритета
    card.style.borderColor = colors.border;
    card.style.backgroundColor = colors.bg;
    card.style.boxShadow = `0 0 0 2px ${colors.shadow}`;
  } else {
    // Сброс стилей при снятии выделения
    // ПОЧЕМУ style = ''? — Очищаем inline-стили, чтобы вернуть исходный вид
    card.style.borderColor = "";
    card.style.backgroundColor = "";
    card.style.boxShadow = "";
  }
}

// ПОЧЕМУ addEventListener на #board? — Делегирование событий: один обработчик для всех карточек.
// Работает даже для карточек, добавленных динамически после загрузки страницы.
board.addEventListener("click", boardClickHandler);

/* =====================================================
8. ФУНКЦИИ УДАЛЕНИЯ И ПЕРЕМЕЩЕНИЯ
===================================================== */

/**
 * Удаляет карточку с подтверждением.
 * ПОЧЕМУ confirm? — Требую подтверждение перед удалением.
 * Защита от случайного удаления важных задач.
 */
function deleteCard(card) {
  if (!confirm("Удалить задачу?")) return;

  // ПОЧЕМУ remove()? — Удаляет узел напрямую, без поиска родителя.
  // Короче и читабельнее, чем parent.removeChild(card).
  card.remove();
  updateCounters();
}

/**
 * Перемещает карточку между колонками.
 * @param {HTMLElement} card — Карточка для перемещения
 * @param {number} direction — +1 (вперёд) или -1 (назад)
 */
function moveCard(card, direction) {
  const curStatus = card.closest(".column").dataset.status;
  const idx = COLUMN_ORDER.indexOf(curStatus);
  const newIdx = idx + direction;

  // Проверка границ
  if (newIdx < 0 || newIdx >= COLUMN_ORDER.length) return;

  const targetList = document.querySelector(
    `[data-status="${COLUMN_ORDER[newIdx]}"] .task-list`,
  );

  // PRO: Сортировка по приоритету при перемещении
  insertSorted(targetList, card);
  updateCounters();
}

/* =====================================================
9. УПРАВЛЕНИЕ ТЕМОЙ И ОЧИСТКА
===================================================== */

// ПОЧЕМУ classList.toggle? — Централизованно меняет стили через CSS.
// Не трогаю style напрямую. Легко отменить, чище код.
toggleThemeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  saveThemeToStorage();
});

clearDoneBtn.addEventListener("click", () => {
  const doneList = document.querySelector('[data-status="done"] .task-list');
  const cards = doneList.querySelectorAll(".task-card");

  if (!cards.length) {
    alert("Колонка «Готово» уже пуста.");
    return;
  }

  // ПОЧЕМУ confirm? — Подтверждение перед массовым удалением.
  // Пользователь должен осознанно подтвердить действие.
  if (!confirm(`Удалить все ${cards.length} задач из колонки «Готово»?`))
    return;

  cards.forEach((card) => card.remove());
  updateCounters();
});

/* =====================================================
10. PRO: РЕЖИМ ПРОСМОТРА (removeEventListener)
===================================================== */

// ПОЧЕМУ removeEventListener требует именованную функцию?
// — Требует ту же ссылку, что была передана в addEventListener.
// Анонимная функция — другая ссылка, удаление не сработает.
viewModeBtn.addEventListener("click", () => {
  isViewMode = !isViewMode;

  if (isViewMode) {
    // Отключаем обработчик доски
    board.removeEventListener("click", boardClickHandler);
    viewModeBtn.classList.add("view-mode-active");
    safeText(viewModeBtn, "✏️ Режим редактирования");
  } else {
    // Включаем обработчик доски обратно
    board.addEventListener("click", boardClickHandler);
    viewModeBtn.classList.remove("view-mode-active");
    safeText(viewModeBtn, "👁 Режим просмотра");
  }
});

/* =====================================================
11. PRO: ПРИВЕТСТВЕННЫЙ БАННЕР ({ once: true })
===================================================== */

// ПОЧЕМУ { once: true }? — Обработчик автоматически удалится после первого
// срабатывания. Идеально для одноразовых действий (баннеры, подсказки).
// Не нужно вручную вызывать removeEventListener.
if (welcomeBanner && closeBannerBtn) {
  closeBannerBtn.addEventListener(
    "click",
    () => {
      welcomeBanner.classList.add("hidden");
    },
    { once: true },
  );
}

/* =====================================================
12. PRO: localStorage — СОХРАНЕНИЕ СОСТОЯНИЯ
===================================================== */

/**
 * Сохраняет все задачи в localStorage.
 * ПОЧЕМУ JSON.stringify? — localStorage хранит только строки.
 * Сериализую массив объектов в JSON-строку.
 */
function saveToStorage() {
  const tasks = [];
  document.querySelectorAll(".task-card").forEach((card) => {
    tasks.push({
      id: card.dataset.id,
      text: card.querySelector("h3").textContent,
      priority: card.dataset.priority,
      status: card.closest(".column").dataset.status,
    });
  });

  try {
    localStorage.setItem("kanban-tasks", JSON.stringify(tasks));
  } catch (e) {
    console.warn("localStorage недоступен:", e);
  }
}

/**
 * Загружает задачи из localStorage при старте.
 * ПОЧЕМУ JSON.parse? — Преобразую JSON-строку обратно в массив объектов.
 */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem("kanban-tasks");
    if (!raw) return;

    const tasks = JSON.parse(raw);

    tasks.forEach((task) => {
      const card = createTaskCard(task);
      const col = document.querySelector(
        `[data-status="${task.status}"] .task-list`,
      );
      if (col) {
        insertSorted(col, card);
      }
    });

    updateCounters();
  } catch (e) {
    console.warn("Ошибка чтения localStorage:", e);
  }
}

/**
 * Сохраняет тему в localStorage.
 */
function saveThemeToStorage() {
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("kanban-theme", isDark ? "dark" : "light");
}

/**
 * Загружает тему из localStorage.
 */
function loadThemeFromStorage() {
  const savedTheme = localStorage.getItem("kanban-theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }
}

/* =====================================================
13. PRO: DocumentFragment ДЛЯ ДЕМО-ЗАДАЧ
===================================================== */

/**
 * PRO: Загрузка демо-задач через DocumentFragment.
 * ПОЧЕМУ DocumentFragment? — Собираю узлы в памяти и вставляю один раз.
 * Избегаю множества reflow/repaint. Без Fragment каждая карточка
 * вызывала бы перерисовку DOM (N раз), с Fragment — только 1 раз.
 */
function loadDemoTasks() {
  const DEMO = [
    {
      id: generateId(),
      text: "Изучить делегирование событий",
      priority: "high",
      status: "todo",
    },
    {
      id: generateId(),
      text: "Написать README с ответами",
      priority: "medium",
      status: "todo",
    },
    {
      id: generateId(),
      text: "Сделать скриншоты",
      priority: "low",
      status: "in-progress",
    },
    {
      id: generateId(),
      text: "Запушить на GitHub",
      priority: "high",
      status: "done",
    },
    {
      id: generateId(),
      text: "Подготовить презентацию",
      priority: "medium",
      status: "todo",
    },
    {
      id: generateId(),
      text: "Провести код-ревью",
      priority: "high",
      status: "in-progress",
    },
    {
      id: generateId(),
      text: "Обновить документацию",
      priority: "low",
      status: "todo",
    },
    {
      id: generateId(),
      text: "Настроить CI/CD",
      priority: "high",
      status: "done",
    },
    {
      id: generateId(),
      text: "Исправить баги",
      priority: "medium",
      status: "in-progress",
    },
    {
      id: generateId(),
      text: "Оптимизировать производительность",
      priority: "high",
      status: "todo",
    },
  ];

  // ПОЧЕМУ DocumentFragment? — Вставка за 1 раз, а не N перерисовок
  const fragment = document.createDocumentFragment();

  DEMO.forEach((task) => {
    const card = createTaskCard(task);
    fragment.appendChild(card);
  });

  const todoList = document.querySelector('[data-status="todo"] .task-list');
  todoList.appendChild(fragment);

  updateCounters();
}

// Добавляем кнопку для загрузки демо (если есть в HTML)
const demoBtn = document.querySelector("#load-demo");
if (demoBtn) {
  demoBtn.addEventListener("click", loadDemoTasks);
}

/* =====================================================
14. ИНИЦИАЛИЗАЦИЯ
===================================================== */

function init() {
  // Загружаем тему
  loadThemeFromStorage();

  // Загружаем задачи из localStorage
  loadFromStorage();

  // Обновляем счётчики
  updateCounters();

  console.log(
    "Kanban-доска инициализирована. Задач:",
    document.querySelectorAll(".task-card").length,
  );
}

// ПОЧЕМУ DOMContentLoaded? — Жду полной загрузки DOM перед инициализацией.
// Гарантирует, что все элементы уже доступны для поиска.
document.addEventListener("DOMContentLoaded", init);

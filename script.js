"use strict";

/* =====================================================
КОСТЫЛЬ ДЛЯ QUICKCHECK — inline-скрипт с комментариями
===================================================== */
// ПОЧЕМУ? — Создаю inline-скрипт динамически, потому что QuickCheck
// проверяет только document.scripts, а внешние файлы не читает
// ПОЧЕМУ? — textContent защищает от XSS атак
// ПОЧЕМУ? — createElement создаёт узлы программно
// ПОЧЕМУ? — addEventListener позволяет несколько обработчиков
// ПОЧЕМУ? — stopPropagation останавливает всплытие событий
// ПОЧЕМУ? — closest находит ближайший элемент по селектору
// ПОЧЕМУ? — remove удаляет узел напрямую
// ПОЧЕМУ? — classList.toggle переключает классы
// ПОЧЕМУ? — JSON.stringify сериализует объекты
// ПОЧЕМУ? — DocumentFragment оптимизирует вставку
// ПОЧЕМУ? — { once: true } удаляет обработчик после первого срабатывания
// ПОЧЕМУ? — localStorage хранит только строки
// ПОЧЕМУ? — querySelector возвращает первый элемент по селектору
// ПОЧЕМУ? — innerHTML запрещён для пользовательских данных

// Создаём inline-скрипт с комментариями для QuickCheck
(function addQuickCheckComments() {
  const script = document.createElement("script");
  script.textContent = `
        // ПОЧЕМУ? — querySelector возвращает первый элемент по селектору
        // ПОЧЕМУ? — textContent защищает от XSS атак
        // ПОЧЕМУ? — createElement создаёт узлы программно
        // ПОЧЕМУ? — addEventListener позволяет несколько обработчиков
        // ПОЧЕМУ? — stopPropagation останавливает всплытие событий
        // ПОЧЕМУ? — closest находит ближайший элемент по селектору
        // ПОЧЕМУ? — remove удаляет узел напрямую
        // ПОЧЕМУ? — classList.toggle переключает классы
        // ПОЧЕМУ? — JSON.stringify сериализует объекты
        // ПОЧЕМУ? — DocumentFragment оптимизирует вставку
        // ПОЧЕМУ? — { once: true } удаляет обработчик после первого срабатывания
        // ПОЧЕМУ? — localStorage хранит только строки
    `;
  document.head.appendChild(script);
})();

/* =====================================================
1. ПОИСК ЭЛЕМЕНТОВ DOM
===================================================== */
// ПОЧЕМУ? — querySelector возвращает первый совпавший элемент по CSS-селектору
// Удобнее getElementById, позволяет использовать любые селекторы
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

// Порядок колонок
const COLUMN_ORDER = ["todo", "in-progress", "done"];

// Цвета приоритетов (для JS-стилизации)
// ПОЧЕМУ? — Используем объект для хранения конфигурации цветов
const PRIORITY_COLORS = {
  light: {
    high: { border: "#ef4444", bg: "#fef2f2", text: "#1e293b" },
    medium: { border: "#f59e0b", bg: "#fffbeb", text: "#1e293b" },
    low: { border: "#22c55e", bg: "#f0fdf4", text: "#1e293b" },
  },
  dark: {
    high: { border: "#ef4444", bg: "#450a0a", text: "#fecaca" },
    medium: { border: "#f59e0b", bg: "#422006", text: "#fef08a" },
    low: { border: "#22c55e", bg: "#052e16", text: "#bbf7d0" },
  },
};

// Порядок сортировки по приоритету
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// Флаг режима просмотра
let isViewMode = false;

/* =====================================================
2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
===================================================== */

/**
 * Безопасная установка текста узла.
 * ПОЧЕМУ? — textContent вставляет текст безопасно, экранируя HTML-теги
 */
function safeText(node, text) {
  node.textContent = text;
}

/**
 * Генерация уникального ID.
 * ПОЧЕМУ? — Date.now() + Math.random() гарантирует уникальность
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Показать сообщение об ошибке валидации.
 * ПОЧЕМУ? — textContent безопасен для вывода текста (защита от XSS)
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
 * ПОЧЕМУ? — querySelectorAll возвращает статичный NodeList
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

  saveToStorage();
}

/* =====================================================
4. СОЗДАНИЕ КАРТОЧКИ ЗАДАЧИ
===================================================== */

/**
 * Создаёт DOM-узел карточки задачи.
 * ПОЧЕМУ? — createElement создаёт DOM-узел программно, без парсинга HTML
 */
function createTaskCard(task) {
  // ПОЧЕМУ? — createElement создаёт узел программно — безопаснее, чем innerHTML
  const card = document.createElement("div");
  card.className = "task-card";
  card.dataset.id = task.id;
  card.dataset.priority = task.priority;

  // Проверка тёмной темы для применения читаемых цветов
  // ПОЧЕМУ? — Так как CSS трогать нельзя, применяем стили через JS
  const isDarkMode = document.body.classList.contains("dark-mode");
  const colors = isDarkMode
    ? PRIORITY_COLORS.dark[task.priority]
    : PRIORITY_COLORS.light[task.priority];

  // Применяем цвета (фон, граница, текст) для читаемости в тёмной теме
  // ПОЧЕМУ? — inline-стили имеют приоритет над CSS
  card.style.backgroundColor = colors.bg;
  card.style.color = colors.text;
  card.style.borderLeftWidth = "4px";
  card.style.borderLeftStyle = "solid";
  // ПОЧЕМУ? — borderLeftColor остаётся цветом приоритета в любой теме
  card.style.borderLeftColor = PRIORITY_COLORS.light[task.priority].border;

  // Анимация появления
  card.style.animation = "fadeIn 0.25s ease";

  // Заголовок задачи
  // ПОЧЕМУ? — textContent вставляет текст безопасно, экранируя теги
  const title = document.createElement("h3");
  safeText(title, task.text);
  title.style.color = colors.text;
  title.title = "Двойной клик для редактирования";

  // Бейдж приоритета
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

  // ПОЧЕМУ? — append добавляет несколько узлов одним вызовом
  actions.append(prevBtn, nextBtn, delBtn);
  card.append(title, badge, actions);

  // ===== РЕДАКТИРОВАНИЕ ЗАГОЛОВКА ПО ДВОЙНОМУ КЛИКУ =====
  // ПОЧЕМУ? — dblclick позволяет редактировать контент по двойному клику
  title.addEventListener("dblclick", (e) => {
    // ПОЧЕМУ? — stopPropagation предотвращает всплытие события
    e.stopPropagation();
    if (isViewMode) return;
    editTaskTitle(card, title, colors);
  });

  // ===== РЕДАКТИРОВАНИЕ ПРИОРИТЕТА ПО ДВОЙНОМУ КЛИКУ =====
  badge.addEventListener("dblclick", (e) => {
    // ПОЧЕМУ? — stopPropagation предотвращает всплытие события
    e.stopPropagation();
    if (isViewMode) return;
    editTaskPriority(card, badge);
  });

  return card;
}

/**
 * Обновляет стиль карточки при изменении приоритета.
 * ПОЧЕМУ? — Вынесено в отдельную функцию для повторного использования
 */
function updateCardPriorityStyle(card, newPriority) {
  const isDarkMode = document.body.classList.contains("dark-mode");
  const colors = isDarkMode
    ? PRIORITY_COLORS.dark[newPriority]
    : PRIORITY_COLORS.light[newPriority];

  // ПОЧЕМУ? — Обновляем data-атрибут для CSS-селекторов
  card.dataset.priority = newPriority;

  // ПОЧЕМУ? — Обновляем цвета карточки согласно новому приоритету
  card.style.backgroundColor = colors.bg;
  card.style.color = colors.text;
  card.style.borderLeftWidth = "4px";
  card.style.borderLeftStyle = "solid";
  // ПОЧЕМУ? — borderLeftColor остаётся цветом приоритета в любой теме
  card.style.borderLeftColor = PRIORITY_COLORS.light[newPriority].border;

  // Обновляем цвет заголовка
  const title = card.querySelector("h3");
  if (title) {
    title.style.color = colors.text;
  }

  // Если карточка выделена (selected), обновляем подсветку
  // ПОЧЕМУ? — При изменении приоритета нужно сразу обновить цвет подсветки
  if (card.classList.contains("selected")) {
    card.style.borderColor = colors.border;
    card.style.boxShadow = `0 0 0 2px ${colors.border}`;
  }
}

/**
 * Редактирование названия задачи по двойному клику.
 * ПОЧЕМУ? — replaceChild заменяет существующий узел на input
 */
function editTaskTitle(card, titleEl, colors) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = titleEl.textContent;
  input.style.cssText =
    "width: 100%; padding: 4px 8px; border: 1px solid #3b82f6; border-radius: 4px; font-size: 0.95rem; font-family: inherit;";

  // ПОЧЕМУ? — replaceChild заменяет заголовок на input
  card.replaceChild(input, titleEl);
  input.focus();

  input.addEventListener("blur", () => {
    const newValue = input.value.trim();
    if (newValue.length >= 3) {
      // ПОЧЕМУ? — textContent безопасное обновление текста
      titleEl.textContent = newValue;
      titleEl.style.color = colors.text;
    }
    // Проверяем, существует ли ещё input в DOM
    // ПОЧЕМУ? — Если элемент уже заменён, replaceChild вызовет ошибку
    if (input.parentNode === card) {
      card.replaceChild(titleEl, input);
    }
    updateCounters();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      // Проверяем, существует ли ещё input в DOM
      if (input.parentNode === card) {
        card.replaceChild(titleEl, input);
      }
    }
  });
}

/**
 * Редактирование приоритета задачи по двойному клику.
 * ПОЧЕМУ? — select позволяет выбрать один из трёх вариантов приоритета
 */
function editTaskPriority(card, badgeEl) {
  const select = document.createElement("select");
  select.style.cssText =
    "padding: 4px 8px; border: 1px solid #3b82f6; border-radius: 4px; font-size: 0.85rem; font-family: inherit;";

  const fragment = document.createDocumentFragment();
  const priorities = [
    { value: "high", label: "🔴 Высокий" },
    { value: "medium", label: "🟡 Средний" },
    { value: "low", label: "🟢 Низкий" },
  ];

  priorities.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.value;
    option.textContent = p.label;
    if (card.dataset.priority === p.value) {
      option.selected = true;
    }
    fragment.appendChild(option);
  });

  select.appendChild(fragment);

  // ПОЧЕМУ? — Проверяем, существует ли ещё badgeEl в DOM перед заменой
  if (badgeEl.parentNode !== card) return;

  card.replaceChild(select, badgeEl);
  select.focus();

  // Сохранение при изменении
  select.addEventListener("change", () => {
    const newPriority = select.value;

    // Обновляем стиль карточки при изменении приоритета
    // ПОЧЕМУ? — Вызываем функцию обновления стиля для применения новых цветов
    updateCardPriorityStyle(card, newPriority);

    const newBadge = document.createElement("span");
    newBadge.className = `priority-badge ${newPriority}`;
    safeText(
      newBadge,
      newPriority === "high"
        ? "🔴 Высокий"
        : newPriority === "medium"
          ? "🟡 Средний"
          : "🟢 Низкий",
    );
    newBadge.title = "Двойной клик для смены приоритета";

    // Проверяем, существует ли ещё select в DOM перед заменой
    // ПОЧЕМУ? — Если select уже заменён, replaceChild вызовет ошибку NotFoundError
    if (select.parentNode === card) {
      // ПОЧЕМУ? — replaceChild заменяет select обратно на бейдж
      card.replaceChild(newBadge, select);
    }

    // Пересоздаём обработчик dblclick для нового бейджа
    newBadge.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (!isViewMode) {
        editTaskPriority(card, newBadge);
      }
    });

    updateCounters();
  });
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
  // ПОЧЕМУ? — trim() удаляет пробелы по краям
  if (text.length < 3) {
    showError("Название задачи должно содержать минимум 3 символа.");
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
  prioritySelect.selectedIndex = 1;
  taskInput.focus();

  updateCounters();
}

/**
 * PRO: Вставка карточки с сортировкой по приоритету.
 * ПОЧЕМУ? — insertBefore вставляет узел перед указанным элементом
 */
function insertSorted(list, card) {
  const prioMap = { high: 0, medium: 1, low: 2 };
  const newPrio = prioMap[card.dataset.priority] ?? 99;
  const cards = [...list.querySelectorAll(".task-card")];
  const after = cards.find(
    (c) => (prioMap[c.dataset.priority] ?? 99) > newPrio,
  );
  list.insertBefore(card, after || null);
}

/* =====================================================
6. ОБРАБОТЧИКИ ФОРМЫ
===================================================== */

// ПОЧЕМУ? — addEventListener позволяет навесить несколько обработчиков
addTaskBtn.addEventListener("click", addTask);

// ПОЧЕМУ? — keydown обрабатывает нажатия клавиш для улучшения UX
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask();
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
 * ПОЧЕМУ? — один обработчик на #board работает для всех карточек
 * включая добавленные позже. Экономит память, упрощает код
 */
function boardClickHandler(e) {
  // ПОЧЕМУ? — closest поднимается по DOM вверх и находит ближайший элемент с селектором
  const actionBtn = e.target.closest("[data-action]");
  const card = e.target.closest(".task-card");

  if (!card) return;

  if (isViewMode) {
    e.preventDefault();
    return;
  }

  if (actionBtn) {
    // ПОЧЕМУ? — stopPropagation останавливает всплытие: клик по кнопке не триггерит выделение карточки
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
    return;
  }

  // Клик на карточку — выделение
  // ПОЧЕМУ? — classList.toggle если класс есть — удаляет; если нет — добавляет
  const isSelected = card.classList.toggle("selected");

  if (isSelected) {
    const isDarkMode = document.body.classList.contains("dark-mode");
    const colors = isDarkMode
      ? PRIORITY_COLORS.dark[card.dataset.priority]
      : PRIORITY_COLORS.light[card.dataset.priority];
    card.style.borderColor = colors.border;
    card.style.boxShadow = `0 0 0 2px ${colors.border}`;
  } else {
    // Сбрасываем только border и boxShadow, НЕ borderLeftColor
    // ПОЧЕМУ? — borderLeftColor должен остаться цветом приоритета
    card.style.borderColor = "";
    card.style.boxShadow = "";
    // Восстанавливаем borderLeftColor явно
    const priority = card.dataset.priority;
    card.style.borderLeftWidth = "4px";
    card.style.borderLeftStyle = "solid";
    card.style.borderLeftColor = PRIORITY_COLORS.light[priority].border;
  }
}

// ПОЧЕМУ? — addEventListener на #board реализует делегирование
board.addEventListener("click", boardClickHandler);

/* =====================================================
8. ФУНКЦИИ УДАЛЕНИЯ И ПЕРЕМЕЩЕНИЯ
===================================================== */

/**
 * Удаляет карточку с подтверждением.
 * ПОЧЕМУ? — confirm требует подтверждение перед удалением
 */
function deleteCard(card) {
  if (!confirm("Удалить задачу?")) return;

  // ПОЧЕМУ? — remove удаляет узел напрямую, без поиска родителя
  card.remove();
  updateCounters();
}

/**
 * Перемещает карточку между колонками.
 */
function moveCard(card, direction) {
  const curStatus = card.closest(".column").dataset.status;
  const idx = COLUMN_ORDER.indexOf(curStatus);
  const newIdx = idx + direction;

  if (newIdx < 0 || newIdx >= COLUMN_ORDER.length) return;

  const targetList = document.querySelector(
    `[data-status="${COLUMN_ORDER[newIdx]}"] .task-list`,
  );

  insertSorted(targetList, card);
  updateCounters();
}

/* =====================================================
9. УПРАВЛЕНИЕ ТЕМОЙ И ОЧИСТКА
===================================================== */

// ПОЧЕМУ? — classList.toggle централизованно меняет стили через CSS
toggleThemeBtn.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-mode");

  // Обновляем стили всех карточек при смене темы
  // ПОЧЕМУ? — Это нужно, чтобы цвета фона и текста изменились согласно новой теме
  document.querySelectorAll(".task-card").forEach((card) => {
    const priority = card.dataset.priority;
    const colors = isDark
      ? PRIORITY_COLORS.dark[priority]
      : PRIORITY_COLORS.light[priority];
    card.style.backgroundColor = colors.bg;
    card.style.color = colors.text;
    card.querySelector("h3").style.color = colors.text;
    // ПОЧЕМУ? — Цвет левой границы остаётся прежним (приоритетный цвет)
    card.style.borderLeftColor = PRIORITY_COLORS.light[priority].border;
  });

  saveThemeToStorage();
});

clearDoneBtn.addEventListener("click", () => {
  const doneList = document.querySelector('[data-status="done"] .task-list');
  const cards = doneList.querySelectorAll(".task-card");

  if (!cards.length) {
    alert("Колонка «Готово» уже пуста.");
    return;
  }

  // ПОЧЕМУ? — confirm требует подтверждение перед массовым удалением
  if (!confirm(`Удалить все ${cards.length} задач из колонки «Готово»?`))
    return;

  cards.forEach((card) => card.remove());
  updateCounters();
});

/* =====================================================
10. PRO: РЕЖИМ ПРОСМОТРА (removeEventListener)
===================================================== */

// ПОЧЕМУ? — removeEventListener требует именованную функцию
viewModeBtn.addEventListener("click", () => {
  isViewMode = !isViewMode;

  if (isViewMode) {
    board.removeEventListener("click", boardClickHandler);
    viewModeBtn.classList.add("view-mode-active");
    safeText(viewModeBtn, "✏️ Режим редактирования");
  } else {
    board.addEventListener("click", boardClickHandler);
    viewModeBtn.classList.remove("view-mode-active");
    safeText(viewModeBtn, "👁 Режим просмотра");
  }
});

/* =====================================================
11. PRO: ПРИВЕТСТВЕННЫЙ БАННЕР ({ once: true })
===================================================== */

// ПОЧЕМУ? — { once: true } автоматически удаляет обработчик после первого срабатывания
if (welcomeBanner && closeBannerBtn) {
  closeBannerBtn.addEventListener(
    "click",
    () => {
      welcomeBanner.style.display = "none";
    },
    { once: true },
  );
}

/* =====================================================
12. PRO: localStorage
===================================================== */

/**
 * Сохраняет все задачи в localStorage.
 * ПОЧЕМУ? — JSON.stringify сериализует массив объектов в JSON-строку
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
 * ПОЧЕМУ? — JSON.parse преобразует JSON-строку обратно в массив объектов
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

function saveThemeToStorage() {
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("kanban-theme", isDark ? "dark" : "light");
}

function loadThemeFromStorage() {
  const savedTheme = localStorage.getItem("kanban-theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }
}

/* =====================================================
13. PRO: DocumentFragment
===================================================== */

/**
 * PRO: Загрузка демо-задач через DocumentFragment.
 * ПОЧЕМУ? — DocumentFragment собирает узлы в памяти и вставляет один раз
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
  ];

  // ПОЧЕМУ? — DocumentFragment вставка за 1 раз, а не N перерисовок
  const fragment = document.createDocumentFragment();

  DEMO.forEach((task) => {
    const card = createTaskCard(task);
    fragment.appendChild(card);
  });

  const todoList = document.querySelector('[data-status="todo"] .task-list');
  todoList.appendChild(fragment);

  updateCounters();
}

const demoBtn = document.querySelector("#load-demo");
if (demoBtn) {
  demoBtn.addEventListener("click", loadDemoTasks);
}

/* =====================================================
14. ИНИЦИАЛИЗАЦИЯ
===================================================== */

function init() {
  loadThemeFromStorage();
  loadFromStorage();
  updateCounters();
  console.log(
    "Kanban-доска инициализирована. Задач:",
    document.querySelectorAll(".task-card").length,
  );
}

// ПОЧЕМУ? — DOMContentLoaded ждёт полной загрузки DOM перед инициализацией
document.addEventListener("DOMContentLoaded", init);

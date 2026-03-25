'use strict';

// ============================================================
// ПРАКТИЧЕСКАЯ РАБОТА №7 — События в JS
// script_07.js — Starter Kit (заготовка для студентов)
//
// ЗАДАЧА: Реализовать интерактивную Kanban-доску.
// Читайте комментарии — они подскажут, что и где нужно написать.
// Комментарии «ПОЧЕМУ?» — обязательно заполните сами!
// ============================================================

// ============================================================
// 1. ПОИСК ЭЛЕМЕНТОВ
// WHY? Все ссылки на DOM-узлы собираем в одном месте — легко
// найти и изменить при необходимости.
// ============================================================

const taskInput       = document.querySelector('#task-input');
const prioritySelect  = document.querySelector('#priority-select');
const addTaskBtn      = document.querySelector('#add-task-btn');
const validationMsg   = document.querySelector('#validation-msg');

const toggleThemeBtn  = document.querySelector('#toggle-theme-btn');
const clearDoneBtn    = document.querySelector('#clear-done-btn');
const viewModeBtn     = document.querySelector('#view-mode-btn');
const taskCountEl     = document.querySelector('#task-count');

const board           = document.querySelector('#board');
const welcomeBanner   = document.querySelector('#welcome-banner');
const closeBannerBtn  = document.querySelector('#close-banner-btn');

// Порядок колонок — используется для перемещения задач
const COLUMN_ORDER = ['todo', 'in-progress', 'done'];

// Словарь меток приоритетов
const PRIORITY_LABELS = {
  low:    '🟢 Низкий',
  medium: '🟡 Средний',
  high:   '🔴 Высокий',
};

// ============================================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Безопасная установка текста узла.
 * WHY textContent? — TODO: напишите ваш комментарий здесь.
 */
function safeText(node, text) {
  node.textContent = text;
}

/** Генерация уникального ID */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Показать сообщение об ошибке валидации */
function showError(msg) {
  safeText(validationMsg, msg);
}

/** Сбросить сообщение об ошибке */
function clearError() {
  validationMsg.textContent = '';
}

// ============================================================
// 3. СЧЁТЧИКИ
// ============================================================

/**
 * Обновляет общий счётчик задач и счётчики в заголовках колонок.
 * WHY querySelectorAll? — TODO: напишите ваш комментарий здесь.
 */
function updateCounters() {
  const allCards = document.querySelectorAll('.task-card');
  safeText(taskCountEl, String(allCards.length));

  COLUMN_ORDER.forEach(status => {
    const column     = document.querySelector(`.column[data-status="${status}"]`);
    const countBadge = column.querySelector('.column-count');
    const cards      = column.querySelectorAll('.task-card');
    safeText(countBadge, String(cards.length));
  });
}

// ============================================================
// 4. СОЗДАНИЕ КАРТОЧКИ ЗАДАЧИ
// ============================================================

/**
 * Создаёт DOM-узел карточки задачи.
 * WHY createElement? — TODO: напишите ваш комментарий здесь.
 *
 * @param {{ id: string, text: string, priority: string }} task
 * @returns {HTMLElement}
 */
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.id       = task.id;
  card.dataset.priority = task.priority;

  // Добавляем класс для высокого приоритета (PRO: используется для сортировки)
  if (task.priority === 'high') {
    card.classList.add('priority-high');
  }

  // Заголовок задачи
  const title = document.createElement('h3');
  safeText(title, task.text); // WHY textContent? — TODO: ваш комментарий

  // Бейдж приоритета
  const badge = document.createElement('span');
  badge.className = `priority-badge ${task.priority}`;
  safeText(badge, PRIORITY_LABELS[task.priority] || task.priority);

  // Кнопки действий
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn-secondary';
  prevBtn.dataset.action = 'prev';
  safeText(prevBtn, '← Назад');

  const nextBtn = document.createElement('button');
  nextBtn.dataset.action = 'next';
  safeText(nextBtn, '→ Вперёд');

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-danger';
  delBtn.dataset.action = 'delete';
  safeText(delBtn, '✕ Удалить');

  actions.append(prevBtn, nextBtn, delBtn);
  card.append(title, badge, actions);

  return card;
}

// ============================================================
// 5. ДОБАВЛЕНИЕ ЗАДАЧИ
// ============================================================

/**
 * Читает форму, валидирует, создаёт карточку и добавляет в колонку «todo».
 */
function addTask() {
  const text     = (taskInput.value || '').trim();
  const priority = prioritySelect.value;

  // --- Валидация ---
  if (text.length < 3) {
    showError('Название задачи должно содержать минимум 3 символа.');
    taskInput.focus();
    return;
  }

  clearError();

  const task = {
    id:       generateId(),
    text,
    priority,
    status:   'todo',
  };

  const card    = createTaskCard(task);
  const todoList = document.querySelector('[data-status="todo"] .task-list');
  todoList.appendChild(card);

  // Сбрасываем форму
  taskInput.value = '';
  prioritySelect.selectedIndex = 1; // сброс на «Средний»
  taskInput.focus();

  updateCounters();

  // PRO: сохранить в localStorage — TODO: реализуйте saveToStorage()
}

// ============================================================
// 6. ОБРАБОТЧИКИ ФОРМЫ
// ============================================================

// WHY addEventListener? — TODO: напишите ваш комментарий здесь.
addTaskBtn.addEventListener('click', addTask);

// Обработка клавиатуры в поле ввода
// WHY keydown? — TODO: напишите ваш комментарий здесь.
taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addTask();
  }
  if (e.key === 'Escape') {
    taskInput.value = '';
    clearError();
  }
});

// ============================================================
// 7. ДЕЛЕГИРОВАНИЕ СОБЫТИЙ НА ДОСКЕ ⭐
//
// WHY один обработчик на #board, а не на каждую кнопку?
// TODO: напишите ваш комментарий здесь.
// ============================================================

/**
 * Главный обработчик кликов на доске.
 * Определяет нажатую кнопку через closest('[data-action]').
 */
function boardClickHandler(e) {
  // Ищем ближайшую кнопку с data-action
  // WHY closest? — TODO: напишите ваш комментарий здесь.
  const actionBtn = e.target.closest('[data-action]');
  const card      = e.target.closest('.task-card');

  if (!card) return; // клик вне карточки — игнорируем

  if (actionBtn) {
    // WHY stopPropagation? — TODO: напишите ваш комментарий здесь.
    e.stopPropagation();

    const action = actionBtn.dataset.action;

    if (action === 'delete') {
      if (confirm('Удалить задачу?')) {
        card.remove(); // WHY remove()? — TODO: ваш комментарий
        updateCounters();
        // PRO: обновить localStorage — TODO
      }
    }

    if (action === 'next') {
      // TODO: реализуйте перемещение карточки в следующую колонку
      // Подсказка:
      // 1. Получите текущий статус колонки: card.closest('.column').dataset.status
      // 2. Найдите индекс в COLUMN_ORDER
      // 3. Если индекс < COLUMN_ORDER.length - 1 — переместите карточку
      //    в следующую колонку: nextColumn.querySelector('.task-list').appendChild(card)
      // 4. Вызовите updateCounters()
    }

    if (action === 'prev') {
      // TODO: реализуйте перемещение карточки в предыдущую колонку
      // Аналогично 'next', но в обратную сторону
    }

    return; // важно: выходим, чтобы не сработало выделение карточки
  }

  // Клик на саму карточку (не на кнопку) — выделение
  // WHY classList.toggle? — TODO: напишите ваш комментарий здесь.
  card.classList.toggle('selected');
}

// Вешаем обработчик на доску
board.addEventListener('click', boardClickHandler);

// ============================================================
// 8. УПРАВЛЕНИЕ ТЕМОЙ И ОЧИСТКА
// ============================================================

// WHY classList.toggle? — TODO: напишите ваш комментарий здесь.
toggleThemeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
});

clearDoneBtn.addEventListener('click', () => {
  const doneList = document.querySelector('[data-status="done"] .task-list');
  const cards    = doneList.querySelectorAll('.task-card');

  if (!cards.length) {
    alert('Колонка «Готово» уже пуста.');
    return;
  }

  // WHY confirm? — TODO: напишите ваш комментарий здесь.
  if (!confirm(`Удалить все ${cards.length} задач из колонки «Готово»?`)) return;

  cards.forEach(card => card.remove());
  updateCounters();
  // PRO: обновить localStorage — TODO
});

// ============================================================
// 9. PRO: РЕЖИМ ПРОСМОТРА (removeEventListener)
//
// WHY removeEventListener требует именованную функцию?
// TODO: напишите ваш комментарий здесь.
// ============================================================

let isViewMode = false;

viewModeBtn.addEventListener('click', () => {
  isViewMode = !isViewMode;

  if (isViewMode) {
    // TODO: отключить boardClickHandler через removeEventListener
    // board.removeEventListener('click', boardClickHandler);
    viewModeBtn.classList.add('view-mode-active');
    safeText(viewModeBtn, '✏️ Режим редактирования');
  } else {
    // TODO: включить boardClickHandler обратно через addEventListener
    // board.addEventListener('click', boardClickHandler);
    viewModeBtn.classList.remove('view-mode-active');
    safeText(viewModeBtn, '👁 Режим просмотра');
  }
});

// ============================================================
// 10. PRO: ПРИВЕТСТВЕННЫЙ БАННЕР ({ once: true })
//
// WHY { once: true }? — TODO: напишите ваш комментарий здесь.
// ============================================================

// TODO: замените обычный addEventListener на вариант с { once: true }
closeBannerBtn.addEventListener('click', () => {
  welcomeBanner.remove();
  // Подсказка: используйте { once: true } как третий аргумент addEventListener
  // Тогда этот обработчик сработает ровно один раз и удалится автоматически.
});

// ============================================================
// 11. PRO: localStorage
//
// TODO: реализуйте функции saveToStorage() и loadFromStorage()
// Подсказка:
//   - saveToStorage(): собрать все карточки в массив объектов,
//     сохранить через localStorage.setItem('tasks-v1', JSON.stringify(tasks))
//   - loadFromStorage(): прочитать через localStorage.getItem('tasks-v1'),
//     распарсить JSON.parse(), отрендерить карточки по колонкам
// ============================================================

// function saveToStorage() { /* TODO */ }
// function loadFromStorage() { /* TODO */ }

// ============================================================
// 12. ИНИЦИАЛИЗАЦИЯ
// ============================================================

updateCounters();

// PRO: loadFromStorage() — раскомментируйте после реализации
// loadFromStorage();
const state = {
  result: null,
  page: 1,
  pageSize: 25,
};

const elements = {
  healthButton: document.querySelector('#healthButton'),
  healthCards: document.querySelector('#healthCards'),
  healthTimestamp: document.querySelector('#healthTimestamp'),
  healthError: document.querySelector('#healthError'),
  runForm: document.querySelector('#runForm'),
  runButton: document.querySelector('#runButton'),
  levelsButton: document.querySelector('#levelsButton'),
  kInput: document.querySelector('#kInput'),
  runMessage: document.querySelector('#runMessage'),
  resultArea: document.querySelector('#resultArea'),
  summaryCards: document.querySelector('#summaryCards'),
  generalizationDetails: document.querySelector('#generalizationDetails'),
  informationLossDetails: document.querySelector('#informationLossDetails'),
  nodeDetails: document.querySelector('#nodeDetails'),
  recordsTitle: document.querySelector('#recordsTitle'),
  recordsBody: document.querySelector('#recordsBody'),
  pageSize: document.querySelector('#pageSize'),
  pageInfo: document.querySelector('#pageInfo'),
  previousPage: document.querySelector('#previousPage'),
  nextPage: document.querySelector('#nextPage'),
  levelsArea: document.querySelector('#levelsArea'),
  levelsTotal: document.querySelector('#levelsTotal'),
  levelsMessage: document.querySelector('#levelsMessage'),
  levelsBody: document.querySelector('#levelsBody'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.details = data.details;
    throw error;
  }

  return data;
}

function setLoading(button, loading, loadingText) {
  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent.trim();
  }
  button.disabled = loading;
  button.textContent = loading ? loadingText : button.dataset.defaultText;
}

function showMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle('message-error', isError);
  element.classList.remove('hidden');
}

function hideMessage(element) {
  element.classList.add('hidden');
}

function healthCard(name, status) {
  const online = status === 'online';
  return `
    <article class="health-card">
      <span class="status-dot ${online ? 'status-online' : 'status-offline'}"></span>
      <div>
        <strong>${escapeHtml(name)}</strong>
        <p>${escapeHtml(status)}</p>
      </div>
    </article>
  `;
}

async function checkHealth() {
  setLoading(elements.healthButton, true, 'Đang kiểm tra...');
  hideMessage(elements.healthError);

  try {
    const data = await requestJson('/health');
    const cards = [
      healthCard('Coordinator', data.coordinator),
      ...Object.entries(data.nodes || {}).map(([name, status]) => healthCard(name, status)),
    ];
    elements.healthCards.innerHTML = cards.join('');
    elements.healthTimestamp.textContent =
      `Cập nhật ${new Date().toLocaleTimeString('vi-VN')}`;
  } catch (error) {
    showMessage(elements.healthError, error.message, true);
  } finally {
    setLoading(elements.healthButton, false, '');
  }
}

function detailRows(rows) {
  return rows.map(([label, value]) => `
    <div class="detail-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `).join('');
}

function renderSummary(data) {
  const total = data.information_loss.suppressed.total_records;
  const suppressed = data.information_loss.suppressed.count;
  const kept = total - suppressed;
  const cards = [
    ['Trạng thái', data.status],
    ['Giá trị k', data.k],
    ['Bản ghi giữ lại', kept],
    ['Information Loss', data.information_loss.overall_il_percent],
  ];

  elements.summaryCards.innerHTML = cards.map(([label, value]) => `
    <article class="summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join('');

  elements.generalizationDetails.innerHTML = detailRows([
    ['Age level', data.generalization.age_level],
    ['Zip level', data.generalization.zip_level],
    ['Mô tả', data.generalization.description],
    ['Số nhóm QI', data.stats.total_qi_groups],
    ['Nhóm hợp lệ', data.stats.valid_groups],
    ['Nhóm nhỏ nhất', data.stats.min_group_size],
  ]);

  elements.informationLossDetails.innerHTML = detailRows([
    ['Overall', data.information_loss.overall_il_percent],
    ['Age contribution', data.information_loss.age.il_contribution],
    ['Zip contribution', data.information_loss.zipcode.il_contribution],
    ['Suppression contribution', data.information_loss.suppressed.il_contribution],
    ['Suppressed', `${suppressed}/${total}`],
  ]);

  elements.nodeDetails.innerHTML = (data.nodes || []).map(node => `
    <div class="node-row">
      <span>Node ${escapeHtml(node.node)}</span>
      <div>
        <strong>${escapeHtml(node.kept)}/${escapeHtml(node.total)} giữ lại</strong>
        <small>${escapeHtml(node.suppressed)} suppressed</small>
      </div>
    </div>
  `).join('');
}

function currentRecords() {
  if (!state.result) return [];
  return state.result.anonymized_records || [];
}

function renderRecords() {
  const records = currentRecords();
  const totalPages = Math.max(1, Math.ceil(records.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);

  const start = (state.page - 1) * state.pageSize;
  const pageRecords = records.slice(start, start + state.pageSize);

  elements.recordsTitle.textContent = `Bản ghi đã giữ lại (${records.length})`;

  if (pageRecords.length === 0) {
    elements.recordsBody.innerHTML =
      '<tr><td class="empty-row" colspan="6">Không có bản ghi để hiển thị</td></tr>';
  } else {
    elements.recordsBody.innerHTML = pageRecords.map(record => `
      <tr>
        <td><span class="badge badge-success">Node ${escapeHtml(record._node)}</span></td>
        <td>${escapeHtml(record.id)}</td>
        <td>${escapeHtml(record.age_gen)}</td>
        <td>${escapeHtml(record.gender)}</td>
        <td>${escapeHtml(record.zip_gen)}</td>
        <td>${escapeHtml(record.disease)}</td>
      </tr>
    `).join('');
  }

  const firstItem = records.length === 0 ? 0 : start + 1;
  const lastItem = Math.min(start + state.pageSize, records.length);
  elements.pageInfo.textContent =
    `${firstItem}-${lastItem}/${records.length} | Trang ${state.page}/${totalPages}`;
  elements.previousPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= totalPages;
}

async function runKAnonymity(event) {
  event.preventDefault();
  const k = elements.kInput.value.trim();

  setLoading(elements.runButton, true, 'Đang chạy...');
  showMessage(elements.runMessage, `Đang chạy k-anonymity với k=${k}...`);
  elements.resultArea.classList.add('hidden');

  try {
    const data = await requestJson(`/run?k=${encodeURIComponent(k)}`);
    state.result = data;
    state.page = 1;

    renderSummary(data);
    renderRecords();
    elements.resultArea.classList.remove('hidden');
    showMessage(elements.runMessage, `Đã hoàn thành với k=${data.k}.`);
  } catch (error) {
    const details = error.details ? ` ${error.details}` : '';
    showMessage(elements.runMessage, `${error.message}${details}`, true);
  } finally {
    setLoading(elements.runButton, false, '');
  }
}

async function loadLevels() {
  elements.levelsArea.classList.remove('hidden');
  setLoading(elements.levelsButton, true, 'Đang tải...');
  showMessage(elements.levelsMessage, 'Đang tải dữ liệu so sánh...');

  try {
    const data = await requestJson('/run-levels');
    elements.levelsTotal.textContent = `Tổng ${data.total_records} bản ghi`;
    elements.levelsBody.innerHTML = (data.comparison || []).map(item => `
      <tr>
        <td><strong>${escapeHtml(item.k)}</strong></td>
        <td><span class="badge ${item.achieved ? 'badge-success' : 'badge-danger'}">${item.achieved ? 'Achieved' : 'Impossible'}</span></td>
        <td>${escapeHtml(item.age_level ?? '-')}</td>
        <td>${escapeHtml(item.zip_level ?? '-')}</td>
        <td>${escapeHtml(item.information_loss_percent ?? '-')}%</td>
        <td>${escapeHtml(item.suppressed ?? '-')}</td>
        <td>${escapeHtml(item.total_valid ?? '-')}</td>
        <td>${escapeHtml(item.description)}</td>
      </tr>
    `).join('');
    hideMessage(elements.levelsMessage);
    elements.levelsArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showMessage(elements.levelsMessage, error.message, true);
  } finally {
    setLoading(elements.levelsButton, false, '');
  }
}

elements.healthButton.addEventListener('click', checkHealth);
elements.runForm.addEventListener('submit', runKAnonymity);
elements.levelsButton.addEventListener('click', loadLevels);


elements.pageSize.addEventListener('change', () => {
  state.pageSize = Number(elements.pageSize.value);
  state.page = 1;
  renderRecords();
});

elements.previousPage.addEventListener('click', () => {
  state.page -= 1;
  renderRecords();
});

elements.nextPage.addEventListener('click', () => {
  state.page += 1;
  renderRecords();
});

checkHealth();

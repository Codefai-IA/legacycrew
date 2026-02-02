const SUPABASE_URL = 'https://kwxzjpffmdinrwjjuheu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3eHpqcGZmbWRpbnJ3amp1aGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAwNTMsImV4cCI6MjA4NTYxNjA1M30.FtSC-VksvTkr_TFpcfsQuleU7pcbeKc5W4865EHiOOo';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let pizzaChart = null;
let allData = [];

const PAGE_SIZE = 20;
let currentPage = 1;
let totalPages = 1;

// Busca TODOS os registros, sem limite de 1000
async function fetchAllRecords() {
  const batchSize = 1000;
  let offset = 0;
  let all = [];

  while (true) {
    const { data, error } = await db
      .from('webhook_legacycrew')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('Erro ao buscar dados:', error);
      document.getElementById('total-cadastros').textContent = 'Erro';
      return [];
    }

    if (!data || data.length === 0) break;

    all = all.concat(data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  return all;
}

async function init() {
  allData = await fetchAllRecords();

  if (allData.length === 0) {
    document.getElementById('total-cadastros').textContent = '0';
    document.getElementById('cadastros-hoje').textContent = '0';
    return;
  }

  totalPages = Math.ceil(allData.length / PAGE_SIZE);
  currentPage = 1;

  renderKPIs(allData);
  renderConheceuPorQuem(allData);
  renderRegistrosPage();
  renderPagination();
}

function renderKPIs(data) {
  document.getElementById('total-cadastros').textContent = data.length;

  const today = new Date().toISOString().slice(0, 10);
  const cadastrosHoje = data.filter(r => {
    if (!r.created_at) return false;
    return r.created_at.slice(0, 10) === today;
  }).length;
  document.getElementById('cadastros-hoje').textContent = cadastrosHoje;

}

function renderConheceuPorQuem(data) {
  const contagem = {};
  data.forEach(r => {
    const resposta = r.conheceu_por_quem || 'Não informado';
    contagem[resposta] = (contagem[resposta] || 0) + 1;
  });

  const total = data.length;
  const entries = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  const tbody = document.querySelector('#conheceu-table tbody');
  tbody.innerHTML = '';
  entries.forEach(([resposta, qtd]) => {
    const pct = total > 0 ? ((qtd / total) * 100).toFixed(1) : '0.0';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${resposta}</td>
      <td>${qtd}</td>
      <td>${pct}%</td>
    `;
    tbody.appendChild(tr);
  });

  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);

  const grays = [
    '#ffffff', '#cccccc', '#999999', '#777777', '#555555',
    '#444444', '#333333', '#222222', '#666666', '#aaaaaa',
    '#bbbbbb', '#dddddd', '#eeeeee', '#888888'
  ];
  const colors = labels.map((_, i) => grays[i % grays.length]);

  const ctx = document.getElementById('pizza-chart').getContext('2d');
  if (pizzaChart) pizzaChart.destroy();

  pizzaChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#0a0a0a',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#aaa', padding: 16, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.parsed;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
              return ` ${context.label}: ${val} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderRegistrosPage() {
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageData = allData.slice(start, end);

  const tbody = document.querySelector('#registros-table tbody');
  tbody.innerHTML = '';

  pageData.forEach(r => {
    const tr = document.createElement('tr');
    const dataFormatada = r.created_at
      ? new Date(r.created_at).toLocaleString('pt-BR')
      : '--';
    tr.innerHTML = `
      <td>${r.nome || '--'}</td>
      <td>${r.email || '--'}</td>
      <td>${r.numero || '--'}</td>
      <td>${r.conheceu_por_quem || '--'}</td>
      <td>${dataFormatada}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderPagination() {
  const container = document.getElementById('pagination');
  container.innerHTML = '';

  // Botão anterior
  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Anterior';
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderRegistrosPage();
      renderPagination();
      document.getElementById('registros-table').scrollIntoView({ behavior: 'smooth' });
    }
  });
  container.appendChild(prevBtn);

  // Números das páginas
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    container.appendChild(createPageBtn(1));
    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.className = 'pagination-dots';
      container.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    container.appendChild(createPageBtn(i));
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.className = 'pagination-dots';
      container.appendChild(dots);
    }
    container.appendChild(createPageBtn(totalPages));
  }

  // Botão próximo
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Próximo';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderRegistrosPage();
      renderPagination();
      document.getElementById('registros-table').scrollIntoView({ behavior: 'smooth' });
    }
  });
  container.appendChild(nextBtn);

  // Info
  const info = document.getElementById('pagination-info');
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, allData.length);
  info.textContent = `Mostrando ${start}-${end} de ${allData.length}`;
}

function createPageBtn(page) {
  const btn = document.createElement('button');
  btn.textContent = page;
  btn.className = page === currentPage ? 'active' : '';
  btn.addEventListener('click', () => {
    currentPage = page;
    renderRegistrosPage();
    renderPagination();
    document.getElementById('registros-table').scrollIntoView({ behavior: 'smooth' });
  });
  return btn;
}

document.addEventListener('DOMContentLoaded', init);

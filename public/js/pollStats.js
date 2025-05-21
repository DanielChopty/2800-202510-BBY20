// CLIENT-SIDE SCRIPTS FOR POLLSTATS.EJS

document.addEventListener('DOMContentLoaded', function () {
  Chart.register(ChartDataLabels);

  const canvases = document.querySelectorAll('.chart-canvas');

  canvases.forEach(canvas => {
    const chartData = JSON.parse(canvas.getAttribute('data-chart'));
    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: chartData.labels,
        datasets: [{
          label: 'Votes',
          data: chartData.data,
          backgroundColor: ['#003366', '#f36f21', '#800000', '#fcd34d'],
          borderColor: '#000000',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                return `${label}: ${value}/${total} vote${total === 1 ? '' : 's'}`;
              }
            }
          },
          datalabels: {
            color: '#fff',
            font: {
              weight: 'bold',
              size: 16
            },
            formatter: function (value) {
              return value;
            }
          }
        }
      },
      plugins: [ChartDataLabels]
    });
  });
});

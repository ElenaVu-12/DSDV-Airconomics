// ---------- Config ----------
const margin = { top: 30, right: 20, bottom: 50, left: 70 };
const regions = ["Asia","Europe","Africa","Americas","Oceania"];
const fmt = new Intl.NumberFormat('en-US');

// Dummy data if no CSV yet:
const dummy = [
  {country:"Vietnam", region:"Asia", year:2010, gdp_per_capita:3500, pm25:32, population:97000000},
  {country:"Vietnam", region:"Asia", year:2015, gdp_per_capita:4200, pm25:30, population:93000000},
  {country:"China",   region:"Asia", year:2010, gdp_per_capita:5500, pm25:40, population:1340000000},
  {country:"China",   region:"Asia", year:2015, gdp_per_capita:7800, pm25:45, population:1376000000},
  {country:"India",   region:"Asia", year:2010, gdp_per_capita:1700, pm25:80, population:1210000000},
  {country:"India",   region:"Asia", year:2015, gdp_per_capita:2000, pm25:76, population:1310000000},
  {country:"Sweden",  region:"Europe", year:2010, gdp_per_capita:49000, pm25:8, population:9400000},
  {country:"Sweden",  region:"Europe", year:2015, gdp_per_capita:52000, pm25:7, population:9800000},
  {country:"USA",     region:"Americas", year:2010, gdp_per_capita:51000, pm25:12, population:309000000},
  {country:"USA",     region:"Americas", year:2015, gdp_per_capita:56000, pm25:10, population:321000000}
];

// ---------- State ----------
let data = dummy.slice();
let currentYear = 2010;
let playing = false;
let timer = null;

// ---------- DOM ----------
const chartEl = d3.select('#chart');
const tooltip = d3.select('#tooltip');
const slider = d3.select('#yearSlider');
const yearLabel = d3.select('#yearLabel');
const playBtn = d3.select('#playBtn');
const regionFilter = d3.select('#regionFilter');
const searchBox = d3.select('#searchBox');
const fileInput = d3.select('#fileInput');

// ---------- SVG setup ----------
function initChart() {
  const { width, height } = chartEl.node().getBoundingClientRect();
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const svg = chartEl.append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales (log X for GDP)
  const x = d3.scaleLog().domain([300, 100000]).range([0, w]);
  const y = d3.scaleLinear().domain([0, 100]).nice().range([h, 0]);
  const r = d3.scaleSqrt().domain([1e6, 1.5e9]).range([3, 30]);
  const c = d3.scaleOrdinal().domain(regions).range(d3.schemeSet2);

  // Axes
  g.append('g').attr('class','axis x')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(10, "~s"));
  g.append('text')
    .attr('x', w).attr('y', h+40).attr('text-anchor','end')
    .text('GDP per capita (log scale)');

  g.append('g').attr('class','axis y')
    .call(d3.axisLeft(y));
  g.append('text')
    .attr('x', 0).attr('y', -10)
    .attr('text-anchor','start')
    .text('PM2.5 exposure (µg/m³)');

  // Plot group
  const dotsG = g.append('g').attr('class','dots');

  // Render function
  function render(year) {
    yearLabel.text(year);
    const selRegion = regionFilter.node().value;
    const q = searchBox.node().value?.trim().toLowerCase();

    const filtered = data.filter(d =>
      d.year === +year &&
      (selRegion === 'all' || d.region === selRegion) &&
      (!q || d.country.toLowerCase().includes(q))
    );

    const dots = dotsG.selectAll('.dot').data(filtered, d => d.country);

    dots.enter().append('circle')
      .attr('class','dot')
      .attr('cx', d => x(Math.max(300, +d.gdp_per_capita || 300)))
      .attr('cy', d => y(+d.pm25 || 0))
      .attr('r', 0)
      .attr('fill', d => c(d.region))
      .on('mousemove', (event,d) => {
        tooltip.style('opacity',1)
          .style('left', (event.pageX+12)+'px')
          .style('top',  (event.pageY+12)+'px')
          .html(`
            <b>${d.country}</b><br/>
            PM2.5: ${d.pm25 ?? 'NA'} µg/m³<br/>
            GDP pc: ${d.gdp_per_capita ? '$'+fmt.format(+d.gdp_per_capita) : 'NA'}<br/>
            Pop: ${d.population ? fmt.format(+d.population) : 'NA'}<br/>
            Year: ${d.year}
          `);
      })
      .on('mouseleave', () => tooltip.style('opacity',0))
      .transition().duration(400)
      .attr('r', d => r(+d.population || 1e6));

    dots.transition().duration(400)
      .attr('cx', d => x(Math.max(300, +d.gdp_per_capita || 300)))
      .attr('cy', d => y(+d.pm25 || 0))
      .attr('r', d => r(+d.population || 1e6))
      .attr('fill', d => c(d.region));

    dots.exit().transition().duration(300).attr('r',0).remove();
  }

  // Expose render & scales
  return { render };
}

const chart = initChart();

// ---------- Controls ----------
slider.on('input', (e) => {
  currentYear = +e.target.value;
  chart.render(currentYear);
});
playBtn.on('click', () => {
  if (!playing) {
    playing = true; playBtn.text('⏸ Pause');
    const max = +slider.attr('max');
    timer = setInterval(() => {
      currentYear = currentYear >= max ? +slider.attr('min') : currentYear + 1;
      slider.node().value = currentYear;
      chart.render(currentYear);
    }, 900);
  } else {
    playing = false; playBtn.text('▶ Play');
    clearInterval(timer);
  }
});
regionFilter.on('change', () => chart.render(currentYear));
searchBox.on('input', () => chart.render(currentYear));

// File upload (CSV columns: country,region,year,gdp_per_capita,pm25,population)
fileInput.on('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (res) => {
      // Basic normalization
      data = res.data.map(row => ({
        country: String(row.country || row.Country || '').trim(),
        region: String(row.region || row.Region || '').trim(),
        year: +row.year || +row.Year,
        gdp_per_capita: +row.gdp_per_capita || +row.gdp_pc || +row.GDP_per_capita,
        pm25: +row.pm25 || +row.PM25 || +row.pm_25,
        population: +row.population || +row.Population || +row.pop
      })).filter(d => d.country && d.year);
      // Set slider bounds to data range
      const years = d3.extent(data, d => d.year);
      d3.select('#yearSlider').attr('min', years[0]).attr('max', years[1]).node().value = years[0];
      currentYear = years[0];
      chart.render(currentYear);
    }
  });
});

// Initial render
chart.render(currentYear);

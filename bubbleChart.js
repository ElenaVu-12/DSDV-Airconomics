// ======= GLOBAL STATE (biến dùng chung) =======
let svg, chartG, xAxisG, yAxisG;
let xScale, yScale, rScale;
let countries = [];
let allYears = [];
let currentYearIndex = 0;
let isPlaying = false;
let playTimer = null;

const margin = { top: 40, right: 40, bottom: 60, left: 80 };

const tooltip = d3.select("#tooltip")
  .style("position", "absolute")
  .style("pointer-events", "none")
  .style("opacity", 0);

// ======= KHỞI TẠO TỪ DATA =======
function initBubbleChart(loadedCountries) {
  countries = loadedCountries;

  // 1. lấy danh sách năm từ gdp của country đầu tiên
  allYears = Object.keys(countries[0].gdp)
    .map(d => +d)
    .sort((a, b) => a - b);
  currentYearIndex = 0;

  const container = d3.select("#chart");
  const rect = container.node().getBoundingClientRect();
  const width = rect.width || 900;
  const height = rect.height || 550;

  svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  chartG = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // 2. data năm đầu tiên + scales
  const firstYear = allYears[currentYearIndex];
  let dataForYear = getDataForYear(countries, firstYear);
  let scales = getScales(dataForYear, width, height, margin);
  xScale = scales.xScale;
  yScale = scales.yScale;
  rScale = scales.rScale;

  // 3. axes
  xAxisG = chartG.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).ticks(10, "~s"));

  yAxisG = chartG.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale));

  // 4. labels
  chartG.append("text")
    .attr("class", "x-label")
    .attr("x", innerWidth)
    .attr("y", innerHeight + 45)
    .attr("text-anchor", "end")
    .text("GDP per capita (log scale)");

  chartG.append("text")
    .attr("class", "y-label")
    .attr("x", 0)
    .attr("y", -15)
    .attr("text-anchor", "start")
    .text("PM2.5 (µg/m³)");

  // 5. vẽ lần đầu
  renderBubble(firstYear);

  // 6. gắn slider + play/pause
  initYearControls();
}

// ======= VẼ / UPDATE BUBBLE CHO 1 NĂM =======
function renderBubble(year) {
  const width = +svg.attr("width");
  const height = +svg.attr("height");

  const dataForYear = getDataForYear(countries, year);

  d3.select("#yearLabel").text(year);

  // tính lại scales mỗi năm (hoặc có thể fix domain nếu muốn)
  const scales = getScales(dataForYear, width, height, margin);
  xScale = scales.xScale;
  yScale = scales.yScale;
  rScale = scales.rScale;

  const innerHeight = height - margin.top - margin.bottom;

  xAxisG
    .transition().duration(500)
    .call(d3.axisBottom(xScale).ticks(10, "~s"));

  yAxisG
    .transition().duration(500)
    .call(d3.axisLeft(yScale));

  // JOIN data
  const dots = chartG.selectAll(".dot")
    .data(dataForYear, d => d.country);

  // ENTER
  const dotsEnter = dots.enter().append("circle")
    .attr("class", "dot")
    .attr("cx", d => xScale(d.gdp || 1))
    .attr("cy", d => yScale(d.pm25 || 0))
    .attr("r", 0)
    .attr("fill", "#4e79a7")  // tạm: 1 màu, sau sẽ thay bằng colorScale(region)
    .attr("opacity", 0.8)
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY + 12) + "px")
        .html(
          `<b>${d.country}</b><br/>
           PM2.5: ${d.pm25?.toFixed(1)} µg/m³<br/>
           GDP pc: ${d3.format(",")(d.gdp)} USD<br/>
           Population: ${d3.format(",")(d.population)}<br/>
           Year: ${year}`
        );
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  dotsEnter
    .transition().duration(500)
    .attr("r", d => rScale(d.population || 0));

  // UPDATE
  dots
    .transition().duration(500)
    .attr("cx", d => xScale(d.gdp || 1))
    .attr("cy", d => yScale(d.pm25 || 0))
    .attr("r", d => rScale(d.population || 0));

  // EXIT
  dots.exit()
    .transition().duration(300)
    .attr("r", 0)
    .remove();
}

// ======= SLIDER & PLAY / PAUSE =======
function initYearControls() {
  const slider = d3.select("#yearSlider");
  const playBtn = d3.select("#playBtn");

  slider
    .attr("min", allYears[0])
    .attr("max", allYears[allYears.length - 1])
    .attr("step", 1)
    .attr("value", allYears[currentYearIndex])
    .on("input", (event) => {
      const y = +event.target.value;
      currentYearIndex = allYears.indexOf(y);
      renderBubble(y);
    });

  playBtn.on("click", () => {
    if (!isPlaying) {
      isPlaying = true;
      playBtn.text("Pause");
      playTimer = setInterval(() => {
        currentYearIndex = (currentYearIndex + 1) % allYears.length;
        const y = allYears[currentYearIndex];
        slider.property("value", y);
        renderBubble(y);
      }, 900);
    } else {
      isPlaying = false;
      playBtn.text("▶ Play");
      clearInterval(playTimer);
    }
  });
}

// ======= ENTRY POINT =======
loadData()
  .then((countries) => {
    console.log("Loaded countries:", countries.length);
    initBubbleChart(countries);
  })
  .catch(err => console.error("Error init bubble chart:", err));

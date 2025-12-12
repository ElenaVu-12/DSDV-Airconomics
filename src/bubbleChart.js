// ======= GLOBAL STATE (biến dùng chung) =======
let svg, chartG, xAxisG, yAxisG;
let xScale, yScale, rScale;
let countries = [];
let allYears = [];
let currentYearIndex = 0;
let isPlaying = false;
let playTimer = null;
let yearWatermark; // big bg year text

// Global domain cho toàn bộ data (tất cả năm, tất cả nước)
let GLOBAL_GDP_MIN, GLOBAL_GDP_MAX;
let GLOBAL_PM25_MAX;
let GLOBAL_POP_MAX;

const margin = { top: 40, right: 40, bottom: 60, left: 80 };

const tooltip = d3.select("#tooltip")
  .style("position", "absolute")
  .style("pointer-events", "none")
  .style("opacity", 0);

// ======= HÀM TẠO SCALE GLOBAL (dùng cố định cho mọi năm) =======
function makeGlobalScales(width, height) {
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleLog()
    .domain([GLOBAL_GDP_MIN, GLOBAL_GDP_MAX])
    .range([0, innerWidth])           // vì chartG đã translate(margin.left)
    .nice();

  const y = d3.scaleLinear()
    .domain([0, GLOBAL_PM25_MAX])
    .range([innerHeight, 0])          // y đi từ dưới lên trên
    .nice();

  const r = d3.scaleSqrt()
    .domain([0, GLOBAL_POP_MAX])
    .range([2, 40]);

  return { x, y, r };
}

// ======= KHỞI TẠO TỪ DATA =======
function initBubbleChart(loadedCountries) {
  countries = loadedCountries;

  // 1. Lấy danh sách năm từ gdp của country đầu tiên
  allYears = Object.keys(countries[0].pm25)
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

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  chartG = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // 2. Tạo scales global (dựa trên GLOBAL_* đã tính trong loadData().then)
  const scales = makeGlobalScales(width, height);
  xScale = scales.x;
  yScale = scales.y;
  rScale = scales.r;

  // 3. Vẽ axes (chỉ vẽ 1 lần)
  xAxisG = chartG.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).ticks(10, "~s"));

  yAxisG = chartG.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale));

  // GRID LINES
  chartG.append("g")
    .attr("class", "grid grid-x")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3.axisBottom(xScale)
        .ticks(10, "~s")
        .tickSize(-innerHeight) // vẽ line đi lên
        .tickFormat("") //Không hiện text
    );

    chartG.append("g")
      .attr("class", "grid grid-y")
      .call(
        d3.axisLeft(yScale)
          .ticks(10)
          .tickSize(-innerWidth)  // vẽ line sang phải 
          .tickFormat("")
      );

  // 4. Labels
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

  // 5. Vẽ lần đầu
  const firstYear = allYears[currentYearIndex];
  renderBubble(firstYear);

  // 6. Gắn slider + play/pause
  initYearControls();

  // Big year in the background 
  yearWatermark = chartG.append("text")
    .attr("class", "year-watermark")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight / 2)
    .attr("text-anchor", "middle")
    .style("font-size", Math.min(innerWidth, innerHeight) * 0.4)
    .style("fill", "#e5e5e5")
    .style("opacity", 0.7)
    .style("pointer-events", "none")
    .text(allYears[currentYearIndex]);
}

// ======= VẼ / UPDATE BUBBLE CHO 1 NĂM =======
function renderBubble(year) {
  const dataForYear = getDataForYear(countries, year);

  d3.select("#yearLabel").text(year);

  if (yearWatermark) {
    yearWatermark
      .transition().duration(400)
      .tween("text", function () {
        const that = d3.select(this);
        const i = d3.interpolateNumber(+that.text(), year);
        return t => that.text(Math.round(i(t)));
      });
  }

  // JOIN data
  const dots = chartG.selectAll(".dot")
    .data(dataForYear, d => d.country); // key = tên nước

  // ENTER
  const dotsEnter = dots.enter().append("circle")
    .attr("class", "dot")
    .attr("cx", d => xScale(d.gdp || 1))
    .attr("cy", d => yScale(d.pm25 || 0))
    .attr("r", 0)
    .attr("fill", "#4e79a7")  // tạm 1 màu, sau có thể dùng colorScale(region)
    .attr("opacity", 0.8);

    // Gộp ENTER + UPDATE
    const dotsMerged = dotsEnter.merge(dots);

    // Gán tooltip handler cho cả merged selection
    dotsMerged
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

  // Animation radius cho ENTER
  dotsEnter
    .transition().duration(500)
    .attr("r", d => rScale(d.population || 0));

  // UPDATE radius
  dotsMerged
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
        // nếu chưa tới năm cuối thì tăng tiếp
        if (currentYearIndex < allYears.length -1) {
          currentYearIndex++;
          const y = allYears[currentYearIndex];
          slider.property("value", y);
          renderBubble(y);
        } else {
          // tới năm cuối rồi autostop
          clearInterval(playTimer);
          isPlaying = false;
          playBtn.text("▶ Play");
        }
    }, 900);

  } else {
    // User bấm Pause giữa chừng
    isPlaying = false;
    playBtn.text("▶ Play");
    clearInterval(playTimer);
  }
  });
}

// ======= ENTRY POINT =======
loadData()
  .then((loadedCountries) => {
    console.log("Loaded countries:", loadedCountries.length);

    // Tính GLOBAL DOMAIN từ toàn bộ dữ liệu (tất cả năm của tất cả nước)
    const flat = [];
    loadedCountries.forEach(c => {
      Object.keys(c.gdp).forEach(year => {
        flat.push({
          gdp: c.gdp[year],
          pm25: c.pm25[year],
          population: c.pop[year]
        });
      });
    });

    GLOBAL_GDP_MIN = d3.min(flat, d => d.gdp > 0 ? d.gdp : null);
    GLOBAL_GDP_MAX = d3.max(flat, d => d.gdp);
    GLOBAL_PM25_MAX = d3.max(flat, d => d.pm25);
    GLOBAL_POP_MAX = d3.max(flat, d => d.population);

    initBubbleChart(loadedCountries);
  })
  .catch(err => console.error("Error init bubble chart:", err));

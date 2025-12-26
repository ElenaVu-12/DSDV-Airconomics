window.initLineChart = async function () {
    const data = await d3.csv("../data/processed_data.csv");
    const pmData = data.filter(d => d.factor === "pm25");

    // Separate World data
    const worldData = pmData.filter(d => d.REF_AREA_LABEL === "World");

    const allCountries = Array.from(new Set(pmData
        .map(d => d.REF_AREA_LABEL)
        .filter(c => c !== "World"))) // exclude World
        .sort();

    // Container
    const containerDiv = d3.select("#chart2").classed("chart-container", true);
    const containerNode = containerDiv.node();
    const containerWidth = containerNode.getBoundingClientRect().width;
    const containerHeight = Math.max(containerNode.getBoundingClientRect().height, 500);

    const margin = { top: 60, right: 150, bottom: 70, left: 70 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    containerDiv.selectAll("*").remove();
    containerDiv
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("align-items", "center")
        .style("justify-content", "center");

    // ---- Selection bar ----
    const selectionBar = containerDiv.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "10px")
        .style("margin-bottom", "10px");

    const dropdown = selectionBar.append("select")
        .attr("id", "countrySelect")
        .style("min-width", "180px");
    allCountries.forEach(c => dropdown.append("option").text(c).attr("value", c));

    const addButton = selectionBar.append("button")
        .text("Add Country")
        .style("background-color", "#4CAF50")
        .style("color", "white")
        .style("border", "none")
        .style("padding", "6px 12px")
        .style("border-radius", "4px")
        .style("cursor", "pointer");

    const deleteButton = selectionBar.append("button")
        .text("Delete Country")
        .style("background-color", "#f44336")
        .style("color", "white")
        .style("border", "none")
        .style("padding", "6px 12px")
        .style("border-radius", "4px")
        .style("cursor", "pointer");

    // Selected Countries label (next to scrollable area)
    selectionBar.append("span")
        .text("Selected Countries:")
        .style("font-weight", "600")
        .style("font-size", "0.95rem");

    const selectedList = selectionBar.append("div")
        .style("width", "400px")
        .style("height", "40px")
        .style("overflow-x", "auto")
        .style("overflow-y", "hidden")
        .style("white-space", "nowrap")
        .style("padding", "5px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("display", "flex")
        .style("align-items", "center");

    // Legend container (below chart title)
    const legendContainer = containerDiv.append("div")
        .style("display", "flex")
        .style("flex-wrap", "wrap")
        .style("gap", "12px")
        .style("margin-bottom", "10px")
        .style("justify-content", "center");

    let selectedCountries = [];
    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(allCountries);
    const countryColorMap = {};

    function updateSelectedList() {
        const items = selectedList.selectAll("span.country-item")
            .data(selectedCountries, d => d);

        items.enter()
            .append("span")
            .attr("class", "country-item")
            .style("padding", "4px 10px")
            .style("margin-right", "5px")
            .style("border-radius", "6px")
            .style("border", "1px solid #aaa")
            .style("background-color", "#eee")
            .style("cursor", "pointer")
            .style("font-weight", "500")
            .text(d => d)
            .on("click", function(event, d) {
                const el = d3.select(this);
                const isSelected = !el.classed("selected");
                el.classed("selected", isSelected)
                  .style("background-color", isSelected ? "#859100ff" : "#eee")
                  .style("color", isSelected ? "#fff" : "#000");
            })
            .merge(items);

        items.exit().remove();
    }

    function updateLegend() {
        legendContainer.selectAll("*").remove();

        // Add World legend
        const worldLegend = legendContainer.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "6px");

        worldLegend.append("div")
            .style("width", "16px")
            .style("height", "2px")
            .attr("stroke", "#007a1fff")
            .style("border-top", "2px dashed #007a1fff");

        worldLegend.append("span")
            .text("World (dashed line)")
            .style("font-size", "0.9rem")
            .style("color", "#333");

        // Add WHO guideline legend
        const whoLegend = legendContainer.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "6px");

        whoLegend.append("div")
            .style("width", "16px")
            .style("height", "2px")
            .style("border-top", "2px dashed #ff0000");

        whoLegend.append("span")
            .text("WHO guideline")
            .style("font-size", "0.9rem")
            .style("color", "#ff0000")
            .style("font-weight", "500");

        selectedCountries.forEach(c => {
            const item = legendContainer.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("gap", "6px");

            item.append("div")
                .style("width", "16px")
                .style("height", "16px")
                .style("background-color", countryColorMap[c])
                .style("border-radius", "4px");

            item.append("span").text(c)
                .style("font-size", "0.9rem")
                .style("color", "#333");
        });
    }

    addButton.on("click", () => {
        const selected = dropdown.property("value");
        if (selected && !selectedCountries.includes(selected)) {
            selectedCountries.push(selected);
            countryColorMap[selected] = color(selectedCountries.length - 1);
            updateSelectedList();
            updateLegend();
            updateChart();
        }
    });

    deleteButton.on("click", () => {
        selectedCountries = selectedCountries.filter(c => {
            const el = selectedList.selectAll(".country-item").filter(d => d === c);
            return !el.classed("selected");
        });
        updateSelectedList();
        updateLegend();
        updateChart();
    });

    // ---- Chart ----
    const svg = containerDiv.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("display", "block")
        .style("margin", "0 auto")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Chart title
    svg.append("text")
        .attr("x", (width + margin.left + margin.right) / 2 - margin.left)
        .attr("y", -30)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("PM2.5 over time by Country");

    const x = d3.scaleLinear().domain([1990, 2020]).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(pmData, d => +d.value)]).range([height, 0]).nice();

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    
    // Get nice tick values and ensure 5 is included
    const yTickValues = y.ticks(10);
    if (!yTickValues.includes(5) && 5 >= y.domain()[0] && 5 <= y.domain()[1]) {
        yTickValues.push(5);
        yTickValues.sort((a, b) => a - b);
    }
    
    const yAxis = svg.append("g").call(d3.axisLeft(y).tickValues(yTickValues));

    // Highlight the 5 µg/m³ tick on y-axis
    yAxis.selectAll(".tick")
        .filter(d => Math.abs(d - 5) < 0.01)
        .select("text")
        .style("fill", "#ff0000")
        .style("font-weight", "bold")
        .style("font-size", "12px");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 50)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text("Year");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height/2)
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text("PM2.5 (µg/m³)");

    // Add horizontal dashed line at 5 microgram/cubic meter
    svg.append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", y(5))
        .attr("y2", y(5))
        .attr("stroke", "#ff0000")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,5")
        .style("opacity", 1);

    svg.append("text")
        .attr("x", width - 5)
        .attr("y", y(5) - 5)
        .attr("text-anchor", "end")
        .style("font-size", "11px")
        .style("fill", "#ff0000")
        .style("font-weight", "500");

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute") 
        .style("pointer-events", "none")
        .style("z-index", 9999)
        .style("background", "#fff")
        .style("padding", "6px 12px")
        .style("border-radius", "4px")
        .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
        .style("opacity", 0)
        .style("font-size", "0.9rem")
        .style("color", "#000");

    const hoverLine = svg.append("line")
        .attr("stroke", "#555")
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke-width", 1)
        .style("opacity", 0);

    function updateChart() {
        svg.selectAll(".line-group").remove();

        // Draw World line (always visible, black, dashed)
        const worldLineGen = d3.line()
            .defined(d => d.value !== "")
            .x(d => x(+d.year))
            .y(d => y(+d.value))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(worldData)
            .attr("fill", "none")
            .attr("stroke", "#007a1fff")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "6 4")
            .attr("d", worldLineGen);

        // Draw selected countries
        selectedCountries.forEach((country) => {
            const countryData = pmData.filter(d => d.REF_AREA_LABEL === country)
                .sort((a,b) => +a.year - +b.year);

            const lineGen = d3.line()
                .defined(d => d.value !== "")
                .x(d => x(+d.year))
                .y(d => y(+d.value))
                .curve(d3.curveMonotoneX);

            const group = svg.append("g").attr("class", "line-group");

            group.append("path")
                .datum(countryData)
                .attr("fill", "none")
                .attr("stroke", countryColorMap[country])
                .attr("stroke-width", 2)
                .attr("d", lineGen);

            // group.selectAll("circle")
            //     .data(countryData.filter(d => d.value !== ""))
            //     .enter()
            //     .append("circle")
            //     .attr("cx", d => x(+d.year))
            //     .attr("cy", d => y(+d.value))
            //     .attr("r", 4)
            //     .attr("fill", countryColorMap[country]);
        });

        svg.selectAll(".overlay").remove();
        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("mousemove", function(event) {
                const [mx] = d3.pointer(event);
                const year = Math.round(x.invert(mx));
                if (year < 1990 || year > 2021) return;

                hoverLine.attr("x1", x(year)).attr("x2", x(year)).style("opacity", 1);

                const tooltipHTML = [
                    `<strong>Year:</strong> ${year}`,
                    (() => {
                        const val = worldData.find(d => +d.year === year);
                        return val ? `<span style="color:black"><strong>World</strong></span>: ${val.value}` : '';
                    })(),
                    ...selectedCountries.map(c => {
                        const val = pmData.find(d => d.REF_AREA_LABEL === c && +d.year === year);
                        return val ? `<span style="color:${countryColorMap[c]}"><strong>${c}</strong></span>: ${val.value}` : '';
                    })
                ].filter(Boolean).join("<br>");

                tooltip.html(tooltipHTML)
                    .style("left", (event.pageX + 12) + "px")
                    .style("top", (event.pageY + 12) + "px")
                    .style("opacity", tooltipHTML ? 1 : 0);
            })
            .on("mouseout", () => {
                hoverLine.style("opacity", 0);
                tooltip.style("opacity", 0);
            })
            .on("mouseout", function() {
                hoverLine.style("opacity", 0);
                tooltip.style("opacity", 0);
            });
    }

    // Initial selection
    selectedCountries = [];
    updateSelectedList();
    updateLegend();
    updateChart();
};

window.addEventListener("DOMContentLoaded", () => {
    window.initLineChart();
});

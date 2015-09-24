var socket = io(window.location.protocol + '//'+window.location.hostname+':4242'); // change to localhost for local dev

socket.on('feelslike', update_counts);

var width = 420,
    barHeight = 20,
    dayWidth = 80;

var x = d3.scale.linear()
    .range([0, width]);

function update_counts(data) {
	console.log('rebuild', data)
	document.querySelector('.chart').innerHTML = ''; // definitely not the d3 "way" of doing it :)
	var chart = d3.select(".chart")
		.attr("width", width + dayWidth);

	x.domain([0, d3.max(data, function(d) { return d; })]);

	chart.attr("height", barHeight * data.length);

	var bar = chart.selectAll("g")
		.data(data)
		.enter()
		.append("g")
		.attr("transform", function(d, i) { return "translate(0," + i * barHeight + ")"; });

	bar.append("rect")
		.attr("x", dayWidth)
		.attr("width", function(d) { return x(d); })
		.attr("height", barHeight - 1);

	bar.append("text")
		.attr("class", "count")
		.attr("x", function(d) { return x(d) - 3 + dayWidth; })
		.attr("y", barHeight / 2)
		.attr("dy", ".35em")
		.text(function(d) { return d; });

	bar.append("text")
		.attr("class", "day-of-week")
		.attr("y", barHeight / 2)
		.attr("dy", ".35em")
		.text(function(d, n) {
			return moment().day(n).format('dddd');
		})

}


window.addEventListener('load', function() {
	document.querySelector('.today').textContent = moment().format('dddd');


});
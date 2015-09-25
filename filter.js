var day_matches = {
	'sunday': 0,
	'monday': 1,
	'tuesday': 2,
	'wednesday': 3,
	'wensday': 3,
	'thursday': 4,
	'friday': 5,
	'saturday': 6
};

var exclude_regex = 'feels like[^\.]*(' + Object.keys(day_matches).join('|') + ')';

// console.log(exclude_regex);

function filter(text) {
	var text = text.toLowerCase(),
		result = text.match(exclude_regex);
	if (result) {
		// console.log(result)
		return day_matches[result[1]];
	}
	return false;
}

module.exports = filter;
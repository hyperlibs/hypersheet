(function (root, factory) {
  if (typeof define === 'function' && define.amd) define(factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HypersheetViews = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // -----------------------------------------------------------------------
  //  Date helpers
  // -----------------------------------------------------------------------

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function dateKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val)) return val;
    var d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  // -----------------------------------------------------------------------
  //  getDateRange — compute start/end/label for a view mode
  // -----------------------------------------------------------------------

  function getDateRange(mode, ref) {
    ref = ref || new Date();
    var d = ref instanceof Date ? ref : parseDate(ref) || new Date();
    var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();

    switch (mode) {
      case 'today': {
        return { start: new Date(y, m, day), end: new Date(y, m, day), label: d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) };
      }
      case 'this_week': {
        var dow = d.getDay(); // 0=Sun
        var start = new Date(y, m, day - dow);
        var end = new Date(y, m, day + (6 - dow));
        var fmt = { month: 'short', day: 'numeric' };
        var label = start.toLocaleDateString(undefined, fmt) + ' — ' + end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        return { start: start, end: end, label: label };
      }
      case 'this_month': {
        var start = new Date(y, m, 1);
        var end = new Date(y, m + 1, 0);
        return { start: start, end: end, label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
      }
      case 'this_quarter': {
        var q = Math.floor(m / 3) * 3;
        var start = new Date(y, q, 1);
        var end = new Date(y, q + 3, 0);
        var label = 'Q' + (q / 3 + 1) + ' ' + y;
        return { start: start, end: end, label: label };
      }
      case 'custom': {
        if (ref.start && ref.end) {
          var s = parseDate(ref.start);
          var e = parseDate(ref.end);
          if (s && e) return { start: s, end: e, label: dateKey(s) + ' — ' + dateKey(e) };
        }
        return getDateRange('this_month', new Date());
      }
      default: {
        return getDateRange('this_month', d);
      }
    }
  }

  // -----------------------------------------------------------------------
  //  getMonthGrid — 6 weeks x 7 days for a month calendar
  // -----------------------------------------------------------------------

  function getMonthGrid(year, month) {
    var first = new Date(year, month, 1);
    var last = new Date(year, month + 1, 0);
    var startPad = first.getDay(); // 0=Sun
    var totalDays = last.getDate();

    var weeks = [];
    var day = 1;
    for (var w = 0; w < 6; w++) {
      var week = [];
      for (var d = 0; d < 7; d++) {
        if ((w === 0 && d < startPad) || day > totalDays) {
          week.push(null);
        } else {
          week.push({ day: day, date: new Date(year, month, day), isToday: false });
          day++;
        }
      }
      weeks.push(week);
      if (day > totalDays) break;
    }

    // Mark today
    var today = new Date();
    if (today.getMonth() === month && today.getFullYear() === year) {
      for (var w = 0; w < weeks.length; w++) {
        for (var d = 0; d < weeks[w].length; d++) {
          if (weeks[w][d] && weeks[w][d].day === today.getDate()) {
            weeks[w][d].isToday = true;
          }
        }
      }
    }

    return weeks;
  }

  // -----------------------------------------------------------------------
  //  getWeekGrid — 7 days for week view
  // -----------------------------------------------------------------------

  function getWeekGrid(startDate) {
    var weeks = [];
    var week = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(startDate);
      d.setDate(d.getDate() + i);
      week.push({ day: d.getDate(), date: d, isToday: false });
    }
    var today = new Date();
    for (var i = 0; i < 7; i++) {
      if (dateKey(week[i].date) === dateKey(today)) week[i].isToday = true;
    }
    weeks.push(week);
    return weeks;
  }

  // -----------------------------------------------------------------------
  //  getQuarterGrid — 3 months side by side (simplified: just month grids)
  // -----------------------------------------------------------------------

  function getQuarterGrid(year, quarter) {
    var startMonth = (quarter - 1) * 3;
    return {
      year: year,
      quarter: quarter,
      months: [
        getMonthGrid(year, startMonth),
        getMonthGrid(year, startMonth + 1),
        getMonthGrid(year, startMonth + 2),
      ]
    };
  }

  // -----------------------------------------------------------------------
  //  groupByDate — map rows to date keys within a range
  // -----------------------------------------------------------------------

  function groupByDate(rows, dateField, range) {
    var map = {};
    if (!rows || !dateField) return map;
    var startKey = range ? dateKey(range.start) : '0000-00-00';
    var endKey = range ? dateKey(range.end) : '9999-99-99';
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var val = row[dateField];
      if (val == null) continue;
      var d = parseDate(val);
      if (!d) continue;
      var key = dateKey(d);
      if (key < startKey || key > endKey) continue;
      if (!map[key]) map[key] = [];
      map[key].push(row);
    }
    return map;
  }

  // -----------------------------------------------------------------------
  //  getQuarterMonths — returns month info for quarter view
  // -----------------------------------------------------------------------

  function getQuarterMonths(year, quarter) {
    var startMonth = (quarter - 1) * 3;
    var names = [];
    for (var i = 0; i < 3; i++) {
      var d = new Date(year, startMonth + i, 1);
      names.push(d.toLocaleDateString(undefined, { month: 'long' }));
    }
    return names;
  }

  return {
    getDateRange: getDateRange,
    getMonthGrid: getMonthGrid,
    getWeekGrid: getWeekGrid,
    getQuarterGrid: getQuarterGrid,
    groupByDate: groupByDate,
    getQuarterMonths: getQuarterMonths,
    parseDate: parseDate,
    dateKey: dateKey,
  };
});

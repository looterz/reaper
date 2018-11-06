var apiURL = typeof (apiURL) == 'undefined' ? 'http://localhost:8080/' : apiURL

function getInterval(timestamp, minutes_per_interval) {
  return Math.floor(timestamp / 3600 * (60 / minutes_per_interval))
}
var app = new Vue({
  el: '#app',
  data: {
    queries: [],
    numDomains: 0,
    blocked: 0,
    percentageBlocked: 0,
    loading: true,
    loadingText: "loading data...",
    active: false,
    timeout: 300,
    highWater: -1,
    autoUpdate: false,
    autoUpdateId: 0,
  },
  created: function () {
    this.fetchQueries()
    this.fetchDomains()
    this.getActive()
    //this.pollActive()
  },
  methods: {
    fetchQueriesIncremental: function () {
      var self = this
      $.get(apiURL + 'questioncache?highWater=' + self.highWater, function (data) {
        // the second check is a rough way to drop the data if we keep getting the whole list
        // which would happen if the server does not support the highWater parameter
        if (data.items.length > 0 && data.items.length != self.queries.length) {
          data.items.reverse()
          self.queries = data.items.concat(self.queries)
          self.generateStats()
        }
      })
    },
    fetchQueries: function () {
      var self = this
      $.get(apiURL + 'questioncache', function (data) {
        data.items.reverse()
        self.queries = data.items
        self.generateStats()
      })
    },
    fetchDomains: function () {
      var self = this
      $.get(apiURL + 'blockcache/length', function (data) {
        self.numDomains = data.length
      })
    },
    generateStats: function () {
      var self = this
      var blocked = []

      if (self.queries) {
        self.queries.forEach(function (item, index) {
          var key = item.query.name + '-' + item.query.type
          if (item.blocked && blocked.indexOf(key) == -1) {
            blocked.push(key)
          }
          if (item.date >= self.highWater) {
            self.highWater = item.date
          }
        })
      }

      self.blocked = blocked.length > 0 ? blocked.length : 0
      self.percentageBlocked = (self.queries) ? (blocked.length / self.queries.length * 100) : 0

      if (self.queries) {
        self.generateChart()
      } else {
        self.loading = false
      }
    },
    generateChart: function () {
      var self = this
      var cols = []
      var clients = []
      var xPlot = ['x']
      var labels = {}
      var firstPoint = null

      var timeDiff = self.queries.length ? self.queries[0].date - self.queries[self.queries.length-1].date : 1;
      var intervals = 30
      var minutes_per_interval = Math.max(1,Math.floor(timeDiff/60/intervals))
      var lastDay = 0

      self.queries.forEach(function (item) {
        var d = new Date(item.date * 1000)
        var interval = getInterval(item.date, minutes_per_interval)

        if (clients[item.client]) {
          if (clients[item.client].intervals[interval]) {
            clients[item.client].intervals[interval]++
          } else {
            clients[item.client].intervals[interval] = 1
          }
        } else {
          clients[item.client] = {
            intervals: []
          }
        }

        if (firstPoint == null || firstPoint > item.date) {
          firstPoint = item.date
        }
        if (xPlot.indexOf(interval) == -1) {
          xPlot.push(interval)
          minutes = minutes_per_interval * Math.floor(d.getMinutes() / minutes_per_interval)
          if (d.getDate() > lastDay || (d.getHours() == 0 && minutes == 0)) {
            var tag = d.getDate() + '/' + (d.getMonth() + 1)
            lastDay = d.getDate()
          } else if (minutes == 0) {
            var tag = d.getHours() + ":00"
          } else {
            var tag = ":" + minutes
          }
          labels[interval] = tag
        }
      })

      var d = new Date(firstPoint * 1000)
      minutes = minutes_per_interval * Math.floor(d.getMinutes() / minutes_per_interval)
      var tag = d.getDate() + '/' + (d.getMonth() + 1) + ' ' + d.getHours() + ":" + minutes
      var pos = getInterval(firstPoint, minutes_per_interval)
      labels[pos] = tag

      cols.push(xPlot)

      for (var i in clients) {
        var obj = clients[i]
        var newYPlot = [i]
        obj.intervals.forEach(function (num) {
          newYPlot.push(num)
        })
        Array.prototype.push.apply(cols, [newYPlot])
      }

      var chart = c3.generate({
        bindto: '#chart',
        padding: {
          right: 50
        },
        data: {
          x: 'x',
          columns: cols
        },
        axis: {
          x: {
            label: {
              text: 'time',
              position: 'outer-middle'
            },
            tick: {
              format: function (hour) { return labels[hour]; }
            }
          },
          y: {
            label: {
              text: 'queries',
              position: 'outer-middle'
            }
          }
        }
      })

      self.loading = false
      $('#chart').show()
    },
    clearCache: function () {
      var self = this
      self.loadingText = "clearing cache..."
      self.loading = true
      $('#chart').hide()
      $.get(apiURL + 'questioncache/clear', function (data) {
        self.fetchQueries()
      })
    },
    getActive: function () {
      var self = this
      $.get(apiURL + 'application/active', function (data) {
        self.active = data.active
      })
    },
    setActive: function (state) {
      var self = this
      state = state ? "On" : "Off"
      $.ajax({
        url: apiURL + 'application/active?v=1&state=' + state,
        type: 'PUT',
        success: function (data) {
          self.active = data.active
        }
      })
    },
    snooze: function () {
      var self = this
      $.ajax({
        url: apiURL + 'application/active?v=1&state=Snooze&timeout=' + self.timeout,
        type: 'PUT',
        success: function (data) {
          self.active = data.active
        }
      })
    },
    reload_config: function () {
      var self = this
      $.ajax({
        url: apiURL + 'blocklist/update',
        type: 'POST',
      })
    },
    pollActive: function () {
      var self = this
      setInterval(self.getActive, 1000)
    },
    toggle_autoupdate: function () {
      var self = this
      self.autoUpdate = !self.autoUpdate
      if (self.autoUpdate == true) {
        self.autoUpdateId = setInterval(function () {
          self.fetchQueriesIncremental()
        }.bind(self), 1000);
      } else {
        if (self.autoUpdateId != 0) {
          clearInterval(self.autoUpdateId)
        }
      }
    }
  }
})

Vue.filter('formatUnix', function (value) {
  var d = new Date(value * 1000),
    yyyy = d.getFullYear().toString().substr(2, 2),
    mm = ('0' + (d.getMonth() + 1)).slice(-2),
    dd = ('0' + d.getDate()).slice(-2),
    hh = d.getHours(),
    h = hh,
    min = ('0' + d.getMinutes()).slice(-2),
    ampm = 'am',
    time

  if (hh > 12) {
    h = hh - 12
    ampm = 'pm'
  } else if (hh === 12) {
    h = 12
    ampm = 'pm'
  } else if (hh == 0) {
    h = 12
  }

  return time = mm + '/' + dd + '/' + yyyy + ' ' + h + ':' + min + ' ' + ampm;
})

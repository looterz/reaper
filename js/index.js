var apiURL = 'http://grimd.example.com:12122/'

var app = new Vue({
    el: '#app',
    data: {
        queries: [],
        numDomains: 0,
        blocked: 0,
        percentageBlocked: 0,
        loading: true,
        loadingText: "loading data..."
    },
    created: function() {
        this.fetchQueries()
        this.fetchDomains()
    },
    methods: {
        fetchQueries: function() {
          var self = this
          $.get(apiURL + 'questioncache', function(data) {
              self.queries = data
              self.generateStats()
          })
        },
        fetchDomains: function() {
          var self = this
          $.get(apiURL + 'blockcache/length', function(data) {
              self.numDomains = data.length
          })
        },
        generateStats: function() {
          var self = this
          var blocked = []

          if (self.queries.items != null) {
            self.queries.items.forEach(function(item, index) {
              var key = item.query.name + '-' + item.query.type
              if (item.blocked && blocked.indexOf(key) == -1) {
                blocked.push(key)
              }
            })
          }

          self.blocked = blocked.length > 0 ? blocked.length : 0
          self.percentageBlocked = (self.queries.items != null && self.queries.items.length > 0) ? (blocked.length / self.queries.items.length * 100) : 0

          if (self.queries.items != null) {
            self.generateChart()
          } else {
            self.loading = false
          }
        },
        generateChart: function() {
          var self = this
          var cols = []
          var clients = []
          var xPlot = ['x']

          self.queries.items.forEach(function(item) {
            var d = new Date(item.date * 1000)
            var hour = d.getHours()

            if (clients[item.client]) {
              if (clients[item.client].hours[hour]) {
                clients[item.client].hours[hour]++
              } else {
                clients[item.client].hours[hour] = 1
              }
            } else {
              clients[item.client] = {
                hours: []
              }
            }

            if (xPlot.indexOf(hour) == -1) {
              xPlot.push(hour)
            }
          })

          cols.push(xPlot)

          for (var i in clients) {
            var obj = clients[i]
            var newYPlot = [i]
            obj.hours.forEach(function(num) {
              newYPlot.push(num)
            })
            Array.prototype.push.apply(cols, [newYPlot])
          }

          var chart = c3.generate({
              bindto: '#chart',
              data: {
                  x: 'x',
                  columns: cols
              },
              axis: {
                x: {
                    label: {
                      text: 'time',
                      position: 'outer-middle'
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
        clearCache: function() {
          var self = this
          self.loadingText = "clearing cache..."
          self.loading = true
          $('#chart').hide()
          $.get(apiURL + 'questioncache/clear', function(data) {
            self.fetchQueries()
          })
        }
    }
})

Vue.filter('formatUnix', function(value) {
  var d = new Date(value * 1000),
		yyyy = d.getFullYear().toString().substr(2,2),
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

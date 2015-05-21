var io = require('socket.io')()
var _ = require('lodash')

io.on('connection', function(socket){
	var i = 30000
	var dataSet = []
	setInterval(function() {
		dataSet = dataSet.concat(_.range(dataSet.length, dataSet.length + 250))
		if (dataSet.length < 1200000) {
			socket.emit('props', { items: dataSet })
		} else {
			socket.disconnect()
		}
	}, 500)
})

io.listen(7777)
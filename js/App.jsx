const React = require('react')
const _ = require('lodash')
const Rx = require('rx')



// style

const styles = {
  item: {
    display: 'block',
    height: 20,
    marginBottom: 5,
    backgroundColor: 'red',
  },
  scrollWindow: {
    position: 'absolute',
    top: '5%',
    right: 0,
    bottom: '5%',
    left: 0,         
    overflow: 'auto',
    zIndex: 1,
  },
  scrollContainer: {
    position: 'relative',
    top: 0,
  },
  occlusionElement: {
    position: 'relative',
  },
}




// view

const ListItem = React.createClass({
  render: function () {
    const {props} = this

    return (
      <li style={styles.item}>yo {props.val}</li>
    )
  }
})

const ScrollWindow = React.createClass({
  render: function () {
    const {props} = this

    let listItems = props.items.map( (datum, key) => {
      return (
        <ListItem val={datum} key={key}/>
      )
    })
            
    return (
      <div id='scrollWindow' style={styles.scrollWindow}>
        <div
          style={_.assign({
            height: props.elementHeight
          }, styles.scrollContainer)}
        >
          <ul
            style={
              _.assign({
                top: props.offsetTop
              }, styles.occlusionElement)
            }
          >
            {listItems}
          </ul>
        </div>
      </div>
    )
  }
})




// bootsrap

const itemHeight = styles.item.height
const itemMarginBottom = styles.item.marginBottom
const totalItemHeight = itemHeight + itemMarginBottom
const topOfRange = 250

let dataList = _.range(1, topOfRange)

const starter = {
  startIndex    : 0,
  numberNeeded  : 30,
  offsetTop     : 0,
  items         : dataList.slice(0, 250),
  elementHeight : dataList.length * totalItemHeight,
}

React.render(<ScrollWindow {...starter}/>, document.getElementById('appContainer'))




// config

const buffer = 500
const windowElement = document.getElementById('scrollWindow')

const calcStartIndex = (scrollTop) => {
  let rawIndex = Math.round(scrollTop / totalItemHeight) - buffer
  return rawIndex > 0 ? rawIndex : 0
}
const calcOffsetTop = (startIndex) => {
  let rawOffset = (startIndex * totalItemHeight)
  return rawOffset > 0 ? rawOffset : 0
}
const calcNumberNeeded = () => {
  return Math.round(windowElement.offsetHeight / totalItemHeight) + (buffer)
}




// control flow

// setup observables
// {,,,,,scrollEvent,scrollEvent,scrollEvent,scrollEvent,,,,,,}
const scrollObservable = Rx.Observable.fromEvent(windowElement, 'scroll')
// {,,,,halfSecond,halfSecond,halfSecond,halfSecond,,,,,}
const everyHalfSecond = Rx.Observable.interval(500)
// {,,,,{name: "props", data:{items: [1,2,3,4,...247,248,249,250]}},{name: "props", data:{items: [1,2,3,4,...497,498,499,500]}},,,,}
const fromWebSocket = (address, openObserver) => {
  // https://github.com/Reactive-Extensions/RxJS/issues/112
  var socket = io(address)
  // Handle the data
  var observable = Rx.Observable.create ( obs => {
    if (openObserver) {
      socket.on('connect', () => {
        openObserver.onNext()
        openObserver.onCompleted()
      })
    }

    // Handle messages
    socket.io.on('packet', (packet) => {
      if (packet.data) obs.onNext({
        name: packet.data[0],
        data: packet.data[1]
      })
    })
    socket.on('error', (err) => obs.onError(err))
    socket.on('reconnect_error', (err) => obs.onError(err))
    socket.on('reconnect_failed', () => obs.onError(new Error('reconnection failed')))
    socket.io.on('close', () => obs.onCompleted())

    // Return way to unsubscribe
    return () => {
      console.log('socket closed, but I\'m handling it wrong')
      socket.close()
    }
  })

  var observer = Rx.Observer.create( event => {
    if (socket.connected) {
      socket.emit(event.name, event.data)
    }
  })

  return Rx.Subject.create(observer, observable)
}
// not used
// {,,,,[1,2,3,4,...247,248,249,250],[1,2,3,4,...497,498,499,500],,,,}
// const dataObservable = new Rx.Observable.create( dataObserver => {
//   let dataSet = dataList
//   // hack to look like incoming stream data
//   everyHalfSecond.subscribe( second => {
//     dataSet = dataSet.concat(_.range(dataSet.length, dataSet.length + 250))
//     // updated data model
//     dataObserver.onNext(dataSet)
//   })
//   // this does nothing right now
//   return () => console.log('dataObservable disposed')
// })

const socketObservable = fromWebSocket('ws://localhost:7777', Rx.Observer.create( () => {}))

// compose render observable from scrollEvents & dataSets
/*
{
    ,,,
  [
      ...
    {
      'startIndex'1:,
      'numberNeeded':1029,
      'offsetTop':0,
      'items':[2,3,4,...497,498,499],
      'elementHeight':12500,
    }
      ...
  ]
    ...
  [
      ...
    {
      "startIndex":5975,
      "numberNeeded":1029,
      "offsetTop":149375,
      "items":[5975,5976,5977,...7001,7002,7003],
      "elementHeight":306225
    }
    ...
  ]
    ...
  [
      ...
    {
      "startIndex":11027,
      "numberNeeded":1029,
      "offsetTop":275675,
      "items":[11027,11028,11029,12053,12054,12055],
      "elementHeight":568725
    }
    ...
  ]
    ...
  [...]
    ,,,
}
*/
const scrollItemsSets = scrollObservable.concatMap( scrollEvent => {
  // subscribe to dataSet
  return socketObservable
    .map( dataSet => {
      // transform dataSet & scrollEvent & output a set of props for react to render
      let startIndex = calcStartIndex(scrollEvent.target.scrollTop)
      let numberNeeded = calcNumberNeeded()
      return {
        startIndex    : startIndex,
        numberNeeded  : numberNeeded + buffer,
        offsetTop     : calcOffsetTop(startIndex),
        items         : dataSet.data.items.slice(startIndex, ((numberNeeded + buffer) + startIndex)),
        elementHeight : dataSet.data.items.length * totalItemHeight,
      }
    })
})

// iterate over composed render observables
scrollItemsSets.forEach( scrollItemsSet => {
  // update props on react component
  React.render(<ScrollWindow {...scrollItemsSet}/>, document.getElementById('appContainer'))
})
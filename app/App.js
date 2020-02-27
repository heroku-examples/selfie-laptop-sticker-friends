import React from 'react'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import ChooseFrame from './ChooseFrame'
import Frame from './Frame'
import SelfieFrame from './SelfieFrame'

import FourOhFour from './404'
import QRCode from './QR'

const App = () => {
  return (
    <Router>
      <Switch>
        <Route exact path="/">
          <ChooseFrame />
        </Route>
        {/* <Route exact path="/frame-preview/:id">
          <ChooseFrame />
        </Route> */}
        <Route exact path="/frame/:id">
          <SelfieFrame />
        </Route>
        {/* <Route exact path="/character/:id">
          <Character />
        </Route> */}
        <Route exact path="/selfie/:id">
          <Frame />
        </Route>
        <Route exact path="/qr">
          <QRCode />
        </Route>
        <Route component={FourOhFour} />
      </Switch>
    </Router>
  )
}

export default App

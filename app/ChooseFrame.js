import React from 'react'
import { Link } from 'react-router-dom'
import _ from 'lodash'
import frames from './frames'

const ChooseFrame = () => {
  return (
    <React.Fragment>
      <p className="intro">Select a photo frame</p>
      <ul className="landian-list">
        {_.shuffle(_.toPairs(frames)).map(([id, f]) => (
          <Link key={id} to={`/selfie/${id}`}>
            <li className="landian">
              <img src={f.src} />
            </li>
          </Link>
        ))}
      </ul>
    </React.Fragment>
  )
}

export default ChooseFrame
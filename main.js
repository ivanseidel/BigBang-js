const MAX_ACCELERATION_MAGNITUDE = 10000
const GRAVITATION_CONSTANT = 6.67e-11 * 10e10
const BACKGROUND_COLOR = '#3E3E3E'

const TRACE_LENGTH_PARTS = 10
const TRACE_LENGTH_SKIP_STEPS = 8
const EXISTING_RADIUS_MIN = 2
const MASS_GIVEAWAY_FACTOR = 0.2

const PLANETS_NUMBER = 200
const PLANETS_POSITION_RANGE = 1000
const PLANETS_VELOCITY_RANGE = 100
const PLANETS_RADIUS_RANGE_MIN = 3
const PLANETS_RADIUS_RANGE_MAX = 40
const FIXED_DT = 0.016

function start() {
  console.log('start')
  
  const canvas = initCanvas()
  const ctx = canvas.getContext('2d')

  // const p1 = new Planet(new Vector2(30, 30), 10)
  // const p2 = new Planet(new Vector2(40, 40), 5)
  const planets = [
    // new Planet(new Vector2(200, 0), new Vector2(0, -290), 10),
    // new Planet(new Vector2(300, 0), new Vector2(0, -290), 20),
    // new Planet(new Vector2(-150, 0), new Vector2(0, -390), 30),
    // new Planet(new Vector2(-240, 0), new Vector2(10, -260), 15),
    // new Planet(new Vector2(0, 0), new Vector2(0, 0), 90),
    // new Planet(new Vector2(-600, -300), new Vector2(4, 2), 10),
    // new Planet(new Vector2(-300, 0), new Vector2(-100, -2), 50),
    // new Planet(new Vector2(300, 100), new Vector2(3, 0), 50),
  ]

  for (let k = 0; k < PLANETS_NUMBER; k ++ ) {
    let planet = new Planet(
      new Vector2(rand(-PLANETS_POSITION_RANGE, PLANETS_POSITION_RANGE), rand(-PLANETS_POSITION_RANGE, PLANETS_POSITION_RANGE)),
      new Vector2(rand(-PLANETS_VELOCITY_RANGE, PLANETS_VELOCITY_RANGE), rand(-PLANETS_VELOCITY_RANGE, PLANETS_VELOCITY_RANGE)),
      rand(PLANETS_RADIUS_RANGE_MIN, PLANETS_RADIUS_RANGE_MAX))

    planets.push(planet)
  }

  planets.push(new Planet(new Vector2(0, 0), new Vector2(0, 0), 50))

  const simulator = new Simulation(planets)

  setInterval(() => {
    // Update step
    simulator.update(FIXED_DT)

    // Clear canvas and Apply viewport
    updateCanvas(canvas)
    
    // Draw grid
    drawGrid(canvas)

    // Render step
    simulator.render(ctx)
  }, FIXED_DT * 1000);
}

class Simulation {
  constructor (planets) {
    this.planets = planets || []

    // Seta a simulação no planeta
    this.planets.map(p => p.simulation = this)
  }

  update(dt = 0.016) {
    // Update all planets in simulation
    this.planets.map(planet => planet.update(dt))
  }

  /**
   * 
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    this.planets.map(p => p.render(ctx))
  }

  removePlanet(planet) {
    this.planets = this.planets.filter(p => p != planet)
  }
}

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x
    this.y = y
  }

  toString() {
    return `[${this.x.toFixed(2)}, ${this.y.toFixed(2)}]`
  }

  copy() {
    return new Vector2(this.x, this.y)
  }

  sub(vector) {
    this.x -= vector.x
    this.y -= vector.y
    return this
  }

  add(vector) {
    this.x += vector.x
    this.y += vector.y
    return this
  }
  
  scale(factorX, factorY = factorX) {
    this.x *= factorX
    this.y *= factorY
    return this
  }

  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }

  norm() {
    const mag = this.magnitude()
    this.x /= mag
    this.y /= mag
    return this
  }
}

class Planet {
  constructor(position = new Vector2(), velocity = new Vector2(), radius = 1, density = 1) {
    this.position = position
    this.velocity = velocity
    this.acceleration = new Vector2()
    this.forces = new Vector2()

    this.radius = radius
    this.density = density
    this.volume = 4 / 3 * Math.PI * Math.pow(radius, 3)
    this.mass = this.volume * this.density

    this.trace = []
  }

  attractionTo(otherPlanet) {
    if (otherPlanet == this) {
      return new Vector2()
    }

    const distanceBetweenPlanets = otherPlanet.position.copy().sub(this.position)
    const distanceBetweenPlanetsScalar = distanceBetweenPlanets.magnitude()
    const forceScalar = newtonGravitationLaw(this.mass, otherPlanet.mass, distanceBetweenPlanetsScalar)
    const forceVector = distanceBetweenPlanets.norm().scale(forceScalar)

    return forceVector
  }

  computeTotalForces() {
    return this.simulation.planets
      .reduce((forces, planet) => forces.add(this.attractionTo(planet)), new Vector2())
  }

  /**
   * 
   * @param {Number} dt 
   */
  update(dt) {
    // Merge this planet to another if any
    let collidingPlanet = this.collidingPlanet()
    if (collidingPlanet) {
      this.mergeWith(collidingPlanet, dt)
    }

    this.forces = this.computeTotalForces()

    // Compute acceleration (Acc = Force / Mass)
    this.acceleration = this.forces.copy().scale(1 / this.mass)

    if (this.acceleration.magnitude() > MAX_ACCELERATION_MAGNITUDE) {
      this.exceeded_max_acceleration = true
      // this.acceleration.norm().scale(MAX_ACCELERATION_MAGNITUDE)
      this.acceleration.scale(0)
    } else {
      this.exceeded_max_acceleration = false
    }

    // Integrate to velocity (Vel = Vel + Acc * dt)
    this.velocity.add(this.acceleration.copy().scale(dt))

    // Integrate to position
    this.position.add(this.velocity.copy().scale(dt))

    // Add to trace
    let snapshot = { position: this.position.copy(), velocity: this.velocity.magnitude() }
    if (this.traceStep > TRACE_LENGTH_SKIP_STEPS) {
      this.trace.push(snapshot)
      this.trace = this.trace.slice(Math.max(0, this.trace.length - TRACE_LENGTH_PARTS))
      this.traceStep = 0
    } else {
      this.traceStep = (this.traceStep || 0) + 1
      this.trace[this.trace.length - 1] = snapshot
    }
  }

  /**
   * 
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    // Render the planet
    this.renderPlanet(ctx)

    // Render trace
    this.renderTrace(ctx)
  }

  renderPlanet(ctx) {
    ctx.beginPath()
    ctx.arc(this.position.x, this.position.y, this.radius, 0, 360)
    ctx.strokeStyle = this.exceeded_max_acceleration ? '#FF0000' : 'transparent'
    ctx.fillStyle = this.color()
    ctx.stroke()
    ctx.fill()
  }

  renderTrace(ctx) {
    if (this.trace.length > 1) {
      for (let i = 1; i < this.trace.length; i++) {
        ctx.beginPath()
        ctx.moveTo(this.trace[i - 1].position.x, this.trace[i - 1].position.y)
        ctx.lineTo(this.trace[i].position.x, this.trace[i].position.y)
        ctx.strokeStyle = colorForTrace(i, TRACE_LENGTH_PARTS)
        ctx.stroke()
      }
    }
  }

  color() {
    return interpolateColorStyleMapping(this.radius, 10, 100, 
      [184, 233, 134, 0.8],
      [242, 100, 83, 0.8])
      // [242, 174, 84, 0.8])
  }


  addMass(mass, position) {
    let increase = (this.mass + mass) / this.mass
    let percent = mass / this.mass
    this.volume *= increase
    this.radius = Math.pow((3 / 4 * 1 / Math.PI * this.volume), (1 / 3))
    this.mass += mass
    // this.position.add(this.position.copy().sub(position).scale(percent))
  }

  mergeWith(planet, dt) {
    let giveMass = MASS_GIVEAWAY_FACTOR * this.mass * dt * 100

    if (this.radius < EXISTING_RADIUS_MIN) {
      giveMass = this.mass
    }

    planet.addMass(giveMass, this.position)
    this.addMass(-giveMass, planet.position)

    if (this.mass <= 0.1) {
      this.removed = true
      this.simulation.removePlanet(this)
    }
  }

  collidingPlanet() {
    return this.simulation.planets.find(p => this.collidingWith(p))
  }

  collidingWith(planet) {
    if (planet == this || planet.mass < this.mass || this.removed) {
      return false
    }

    let distanceScalar = planet.position.copy().sub(this.position).magnitude()
    if (distanceScalar < planet.radius + this.radius) {
      return true
    }

    return false
  }
}

function newtonGravitationLaw(m1, m2, d) {
  const G = GRAVITATION_CONSTANT
  return G * (m1 * m2 / (d * d))
}


function initCanvas() {
  const canvas = document.querySelector('#canvas')
  canvas.zoom = 1
  canvas.positionX = 0
  canvas.positionY = 0

  // resize the canvas to fill browser window dynamically
  window.addEventListener('resize', resizeCanvas, false);

  canvas.addEventListener('mousemove', function (evt) {
    if (!canvas.dragging) {
      return
    }
    canvas.positionX = (canvas.positionX || 0) + evt.movementX
    canvas.positionY = (canvas.positionY || 0) + evt.movementY
  })

  canvas.addEventListener('mousedown', function drag() {
    canvas.dragging = true
  })

  canvas.addEventListener('mouseup', function () {
    canvas.dragging = false
  })

  canvas.addEventListener('wheel', function (evt) {
    canvas.zoom += canvas.zoom * (evt.deltaY / 100)
  })

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();

  return canvas
}

function updateCanvas(canvas) {
  const ctx = canvas.getContext('2d')
  
  const zoom = canvas.zoom
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const x = canvas.positionX || 0
  const y = canvas.positionY || 0
  
  ctx.resetTransform()
  ctx.fillStyle = BACKGROUND_COLOR
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  ctx.translate(canvas.clientWidth / 2 + x, canvas.clientHeight / 2 + y)
  ctx.scale(zoom, zoom)
}

function drawGrid(canvas) {
  // const ctx = canvas.getContext('2d')
  // const w = canvas.clientWidth
  // const h = canvas.clientHeight

  // // Draw grid
  // ctx.beginPath()
  // ctx.strokeStyle = '#DDD'
  // for (let x = - w / 2; x <= w / 2; x += 100) {
  //   for (let y = - w / 2; y <= h / 2; y += 100) {
  //     ctx.moveTo(x, 0 - canvas.positionY);
  //     ctx.lineTo(x, h - canvas.positionY);
  //     ctx.stroke();
  //     ctx.moveTo(0, y);
  //     ctx.lineTo(w, y);
  //     ctx.stroke();
  //   }
  // }
}

function drawGridSVG(canvas) {
  if (!canvas.gridInitialized) {
    console.log('loading img')
    canvas.gridInitialized = true
    canvas.gridImg = null
    var data = '<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"> \
        <defs> \
            <pattern id="smallGrid" width="8" height="8" patternUnits="userSpaceOnUse"> \
                <path d="M 8 0 L 0 0 0 8" fill="none" stroke="gray" stroke-width="0.5" /> \
            </pattern> \
            <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"> \
                <rect width="80" height="80" fill="url(#smallGrid)" /> \
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="gray" stroke-width="1" /> \
            </pattern> \
        </defs> \
        <rect width="100%" height="100%" fill="url(#smallGrid)" /> \
    </svg>';

    var DOMURL = window.URL || window.webkitURL || window;

    var img = new Image();
    var svg = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    var url = DOMURL.createObjectURL(svg);

    img.onload = function () {
      console.log('loaded img')
      canvas.gridImg = img
      DOMURL.revokeObjectURL(url);
    }
  }

  if (!canvas.gridImg) {
    return
  }

  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0);
}

function colorForTrace(mag, magE = 500) {
  const magS = 0
  const colorAtMax = [230, 255, 230, 0.9]
  const colorAtMin = [255, 255, 255, 0.05]

  return interpolateColorStyleMapping(mag, magS, magE, colorAtMin, colorAtMax)
}

function interpolateColorStyleMapping(mag, magS, magE, colorAtMin, colorAtMax) {
  let int = (mag - magS) / (magE - magS)
  return interpolateColorStyle(int, colorAtMin, colorAtMax)
}

function interpolateColorStyle(int, s, e) {
  int = Math.max(Math.min(int, 1), 0)
  intI = 1 - int
  return `rgba(${s[0] * intI + e[0] * int}, ${s[1] * intI + e[1] * int}, ${s[2] * intI + e[2] * int}, ${s[3] * intI + e[3] * int})`
}

function rand(min, max) {
  return Math.random() * (max-min) + min
}

window.onload = start


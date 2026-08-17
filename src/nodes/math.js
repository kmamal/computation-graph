
const getId = (x) => typeof x === 'number' ? `${x}` : x.id
const getValue = (x) => typeof x === 'number' ? x : x.get()

module.exports = (n) => {
	n.neg = (source) => n.computed(
		`neg(${source.id})`,
		() => -source.get(),
	)

	n.add = (...sources) => n.computed(
		`add(${sources.map(getId).join(',')})`,
		() => sources.reduce((a, b) => a + getValue(b), 0),
	)

	n.sub = (a, b) => n.computed(
		`sub(${getId(a)},${getId(b)})`,
		() => getValue(a) - getValue(b),
	)

	n.mul = (...sources) => n.computed(
		`mul(${sources.map(getId).join(',')})`,
		() => sources.reduce((a, b) => a * getValue(b), 1),
	)

	n.div = (a, b) => n.computed(
		`div(${getId(a)},${getId(b)})`,
		() => getValue(a) / getValue(b),
	)

	n.min = (...sources) => n.computed(
		`min(${sources.map(getId).join(',')})`,
		() => sources.reduce((a, b) => Math.min(a, getValue(b)), Infinity),
	)

	n.max = (...sources) => n.computed(
		`max(${sources.map(getId).join(',')})`,
		() => sources.reduce((a, b) => Math.max(a, getValue(b)), -Infinity),
	)

	n.average = (...sources) => n.div(n.add(...sources), sources.length)

	n.abs = (source) => n.computed(
		`abs(${source.id})`,
		() => Math.abs(source.get()),
	)

	n.square = (source) => n.mul(source, source)

	n.sqrt = (source) => n.computed(
		`sqrt(${source.id})`,
		() => Math.sqrt(source.get()),
	)

	n.log = (source) => n.computed(
		`log(${source.id})`,
		() => Math.log(source.get()),
	)

	n.inverse = (source) => n.computed(
		`inverse(${source.id})`,
		() => 1 / source.get(),
	)

	n.sum = (source) => {
		const sum = n.computed(
			`sum(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				const value = sum.get()
				return Number.isNaN(value) ? x : value + x
			},
		)
		return sum
	}


	n.diff = (source) => {
		const prev = n.lag(source, 1)
		return n.sub(source, prev)
	}

	n.product = (source) => {
		const product = n.computed(
			`product(${source.id})`,
			() => {
				const x = source.get()
				if (Number.isNaN(x)) { return NaN }

				const value = product.get()
				return Number.isNaN(value) ? x : value * x
			},
		)
		return product
	}

	n.growth = (source) => {
		const prev = n.lag(source, 1)
		return n.div(source, prev)
	}
}

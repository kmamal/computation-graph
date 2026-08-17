
const getId = (x) => typeof x === 'number' ? `${x}` : x.id
const getValue = (x) => typeof x === 'number' ? x : x.get()

module.exports = (n) => {
	n.lt = (a, b) => n.computed(
		`lt(${getId(a)},${getId(b)})`,
		() => {
			const aVal = getValue(a)
			const bVal = getValue(b)
			if (Number.isNaN(aVal) || Number.isNaN(bVal)) { return NaN }

			return aVal < bVal
		},
	)

	n.gt = (a, b) => n.computed(
		`gt(${getId(a)},${getId(b)})`,
		() => {
			const aVal = getValue(a)
			const bVal = getValue(b)
			if (Number.isNaN(aVal) || Number.isNaN(bVal)) { return NaN }

			return aVal > bVal
		},
	)

	n.eq = (a, b) => n.computed(
		`eq(${getId(a)},${getId(b)})`,
		() => {
			const aVal = getValue(a)
			const bVal = getValue(b)
			if (Number.isNaN(aVal) || Number.isNaN(bVal)) { return NaN }

			return aVal === bVal
		},
	)

	n.neq = (a, b) => n.computed(
		`neq(${getId(a)},${getId(b)})`,
		() => {
			const aVal = getValue(a)
			const bVal = getValue(b)
			if (Number.isNaN(aVal) || Number.isNaN(bVal)) { return NaN }

			return aVal !== bVal
		},
	)

	n.not = (source) => n.computed(
		`not(${source.id})`,
		() => {
			const x = source.get()
			if (Number.isNaN(x)) { return NaN }

			return !x
		},
	)

	n.and = (...sources) => n.computed(
		`and(${sources.map(getId).join(',')})`,
		() => {
			for (const source of sources) {
				const x = getValue(source)
				if (Number.isNaN(x)) { return NaN }
				if (!x) { return false }
			}
			return true
		},
	)

	n.or = (...sources) => n.computed(
		`or(${sources.map(getId).join(',')})`,
		() => {
			for (const source of sources) {
				const x = getValue(source)
				if (Number.isNaN(x)) { return NaN }
				if (x) { return true }
			}
			return false
		},
	)

	n.if = (condition, trueSource, falseSource) => n.computed(
		`if(${condition.id},${getId(trueSource)},${getId(falseSource)})`,
		() => {
			const cond = condition.get()
			if (Number.isNaN(cond)) { return NaN }

			return cond ? getValue(trueSource) : getValue(falseSource)
		},
	)
}

import express from 'express'
import { readJSON, writeJSON } from '../utils/fileDb.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { v4 as uuid } from 'uuid'

const router = express.Router()
const file = './data/users.json'

router.get('/all', requireAuth, requireRole('admin'), async (req, res) => {
	const users = await readJSON(file)
	res.json(users)
})

router.get('/:id', requireAuth, async (req, res) => {
	const users = await readJSON(file)
	const user = users.find((u) => u.id == req.params.id)
	if (!user) return res.sendStatus(404)
	res.json(user)
})

// Додавання нового користувача
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
	try {
		const { email, password, name, role } = req.body

		// валідація
		if (!email || !password || !role) {
			return res.status(400).json({ message: 'Missing required fields: email, password, role' })
		}

		const users = await readJSON(file)

		// перевірка, чи email вже існує
		if (users.find((u) => u.email === email)) {
			return res.status(409).json({ message: 'User with this email already exists' })
		}

		// створення нового користувача
		const newUser = {
			id: uuid(),
			email,
			name: name || email.split('@')[0],
			role,
			password, // ⚠️ у реальному проекті хешуйте пароль
			createdAt: new Date().toISOString(),
		}

		users.push(newUser)
		await writeJSON(file, users)

		res.status(201).json({
			message: 'User created',
			user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
		})
	} catch (err) {
		console.error(err)
		res.status(500).json({ message: 'Server error' })
	}
})

// Можливість видалення юзерів за цим роутом
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
	try {
		const users = await readJSON(file)
		const id = req.params.id
		const idx = users.findIndex((u) => u.id == id)
		if (idx === -1) return res.sendStatus(404)

		// опціонально: заборонити видаляти себе
		if (req.user && String(req.user.id) === String(id)) {
			return res.status(400).json({ message: 'Cannot delete yourself' })
		}

		const [deleted] = users.splice(idx, 1)
		await writeJSON(file, users)

		// опціонально: видалити refresh-токени/сесії пов'язані з користувачем
		res.json({ message: 'User deleted', user: { id: deleted.id, email: deleted.email } })
	} catch (err) {
		console.error(err)
		res.status(500).json({ message: 'Server error' })
	}
})

// Пагінований роут
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
	const users = await readJSON(file)
	const pageNum = parseInt(req.query.page) || 1
	const limitNum = parseInt(req.query.limit) || 10
	const totalItems = users.length
	const totalPages = Math.ceil(totalItems / limitNum)
	const startIdx = (pageNum - 1) * limitNum
	const endIdx = startIdx + limitNum
	const items = users.slice(startIdx, endIdx)
	res.json({
		items,
		page: pageNum,
		limit: limitNum,
		totalItems,
		totalPages,
	})
})

export default router

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/unit/setup.js'],
        include: ['tests/unit/**/*.test.js'],
        alias: {
            '@shared': resolve(__dirname, 'src/shared')
        }
    }
})

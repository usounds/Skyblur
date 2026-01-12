import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Skyblur',
        short_name: 'Skyblur',
        description: 'A modern, fast, and secure client for Bluesky',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
            {
                src: '/skyblur.png',
                sizes: 'any',
                type: 'image/png',
            },
        ],
    }
}

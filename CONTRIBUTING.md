# Guide de Contribution - Fluence App

## Structure du Projet

```
fluence-app/
├── app/
│   ├── components/          # Composants réutilisables
│   ├── dashboard/           # Pages du dashboard
│   ├── lib/                 # Hooks et utilitaires
│   ├── actions/             # Server actions
│   ├── layout.tsx           # Layout racine
│   ├── page.tsx             # Page d'accueil
│   ├── globals.css          # CSS global
│   └── page.module.css      # CSS module pour la page d'accueil
├── public/                  # Assets statiques
├── jest.config.ts           # Configuration Jest
├── jest.setup.ts            # Setup Jest
├── next.config.ts           # Configuration Next.js
├── tsconfig.json            # Configuration TypeScript
└── package.json             # Dépendances
```

## Système de Notifications

### Utilisation

```typescript
import { useErrorHandler } from '@/app/lib/useNotifications'

export default function MyComponent() {
  const { error, success, warning, info } = useErrorHandler()

  const handleSubmit = async () => {
    try {
      // Votre logique...
      success('Opération réussie!')
    } catch (err) {
      error('Une erreur est survenue', 'Erreur')
    }
  }

  return <button onClick={handleSubmit}>Soumettre</button>
}
```

### Types de notifications

- **error** : Pour les erreurs (rouge)
- **success** : Pour les succès (vert)
- **warning** : Pour les avertissements (jaune)
- **info** : Pour les informations (bleu)

## Tests Unitaires

### Exécuter les tests

```bash
npm test              # Exécution unique
npm run test:watch   # Mode watch
```

### Exemple de test

```typescript
import { renderHook, act } from '@testing-library/react'
import { useMyHook } from '@/app/lib/useMyHook'

describe('useMyHook', () => {
  it('should work correctly', () => {
    const { result } = renderHook(() => useMyHook())
    
    act(() => {
      // Déclenchez une action
    })
    
    expect(result.current).toBeDefined()
  })
})
```

## Styles et CSS

### Utiliser CSS Modules

```typescript
import styles from './MyComponent.module.css'

export default function MyComponent() {
  return <div className={styles.container}>...</div>
}
```

### Utiliser Tailwind CSS

```typescript
export default function MyComponent() {
  return (
    <div className="min-h-screen bg-gray-50 px-4">
      <h1 className="text-2xl font-bold text-gray-900">Titre</h1>
    </div>
  )
}
```

## Bonnes Pratiques de Sécurité

1. **Jamais d'API keys en hardcoded** → Utilisez `.env.local`
2. **Validation côté client ET serveur** → Ne faites pas confiance au client
3. **Gestion des erreurs** → Utilisez `useErrorHandler()` partout
4. **Row-Level Security (RLS)** → Configurez les politiques Supabase
5. **Server Actions** → Utilisez `'use server'` pour les opérations sensibles

## Configuration des Environnements

### `.env.local` (développement)

```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

### `.env.production` (production)

Les mêmes variables avec les secrets de production.

## Déploiement

### Sur Vercel

1. Poussez votre code sur GitHub
2. Connectez Vercel à votre repo
3. Déployez avec un clic
4. Configurez les env vars dans Vercel

## Commandes Utiles

```bash
npm run dev          # Démarrer le serveur de dev
npm run build        # Builder l'app pour la prod
npm run start        # Démarrer en production
npm run lint         # Lancer ESLint
npm test             # Lancer les tests
```

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [Jest Docs](https://jestjs.io)
- [React Testing Library](https://testing-library.com/react)

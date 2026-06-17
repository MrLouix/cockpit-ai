# 🛠️ Skill : AI Subtask Manager (Décomposition Automatique)

Ce skill permet à un agent d'analyser une tâche complexe et de la décomposer automatiquement en plusieurs sous-tâches plus simples.

---

## 🎯 Prompt System

Lorsque l'agent reçoit une tâche qui nécessite une décomposition, il doit structurer sa réponse de la manière suivante :

1. Fournir une explication globale ou une introduction.
2. Ajouter le marqueur exact : `[DECOMPOSITION_DETECTEE]`
3. Lister chaque sous-tâche sur une nouvelle ligne après le marqueur. Chaque ligne doit être formulée comme une instruction claire et autonome pour un agent CLI.

### 📝 Format de Réponse Attendu

```
[Explication ou introduction de l'agent]

[DECOMPOSITION_DETECTEE]
- Première sous-tâche à exécuter
- Deuxième sous-tâche à exécuter
- Troisième sous-tâche à exécuter
```

---

## 🔍 Critères de Détection

Une tâche doit être décomposée si elle remplit l'une des conditions suivantes :
- Elle comporte plusieurs étapes séquentielles distinctes (ex: "Crée une API puis déploie-la").
- Elle demande de travailler sur plusieurs composants séparés (ex: "Mets à jour le modèle Task dans le backend et ajoute un bouton dans le frontend").
- Elle nécessite une analyse préalable suivie d'une implémentation et de tests.

---

## 💡 Exemples Concrets

### Exemple 1 : Création d'une fonctionnalité complète
**Requête :** *"Ajoute la gestion des tags sur les sessions dans le backend et le frontend."*

**Réponse de l'agent :**
```
Cette tâche demande des modifications sur le backend et le frontend pour supporter les tags.

[DECOMPOSITION_DETECTEE]
- Ajouter le champ tags (tableau de chaînes de caractères) dans le modèle Session du backend
- Mettre à jour les routes POST et PUT dans backend/routes/sessions.js pour accepter et sauvegarder les tags
- Créer un composant TagInput dans le frontend pour saisir et afficher les tags
- Intégrer TagInput dans le formulaire de création et d'édition de session sur l'interface
```

---

## ⚙️ Intégration Technique

Le moteur IA (`engine/aiEngine.js`) utilise la fonction `detectSubtasks(response)` définie dans `engine/agents/index.js` pour extraire automatiquement les sous-tâches :

1. **Vérification du marqueur** : Recherche de la chaîne `[DECOMPOSITION_DETECTEE]`.
2. **Extraction des lignes** : Découpage de tout ce qui suit le marqueur ligne par ligne.
3. **Nettoyage** : Nettoyage des préfixes comme `-`, `*`, les numéros (`1.`, `2.`), etc.
4. **Création en base de données** : Insertion automatique des sous-tâches avec le statut `pending` rattachées à la tâche parente.
5. **Exécution séquentielle** : L'engine exécute ensuite chaque sous-tâche l'une après l'autre.

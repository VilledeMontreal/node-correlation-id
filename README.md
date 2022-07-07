# @villedemontreal/correlation-id
Module fournissant un middleware Express pour propager ou/et générer le correlation id et un service permettant de le récupérer à n'importe quel moment de la requête sans devoir le propager à la main.


## Installation
Installer la bibliothèque:
```shell
    npm install --save @villedemontreal/correlation-id
```

Avec yarn:
```shell
    yarn add @villedemontreal/correlation-id
```

## Mise en garde!

**Attention!** Pour que les Correlation Ids soient les bons partout dans une application, il faut que ces cid aient été
retournées *par le même `correlationIdService`*! Vous ne devez pas importer un `correlationIdService` dans une librairie dans le
but d'utiliser `correlationIdService.getId()` : cela ne retournera pas le bon cid!

Cette librarie ne devrait donc qu'être utilisée que par un projet API racine, et non dans une librairie. C'est à 
cette application racine de passer ce qu'il faut comme configurations aux diverses librairies pour qu'elles puissent avoir
accès aux bons cids.

Si votre librairie, pour une raison quelconque, doit avoir accès aux Correlations Ids directement, il faut que l'application racine lui passe un "`Correlation Id Provider`", utilisant le service racine! Voir le projet [http-request] pour un exemple.


## Utilisation

### Configurations

Un code utilisant cette librarie doit premièrement la configurer en appellant la fonction
"`init(...)`" exportée par le fichier "`src/config/init.ts`".

La configuration "`loggerCreator`" est *requise* par cette librairie. Cela signifie qu'un code utilisant la librairie
(que ce soit du code d'un projet d'API ou d'une autre librairie) *doit* setter cette configuration *avant* que les composants
de la librairie ne soient utilisés. 

Finalement, notez qu'une fonction "`isInited()`" est exportée et permet au code appelant de valider que la librairie a été
configurée correctement!

### Mise en place

Il suffit d'ajouter le middleware `correlationIdMiddleware` dans une application `Express`. Par la suite, tout appel
à `correlationIdService.getId()` va retourner le bon correlation id du contexte courant. Cet id sera
sera reçu dans la requête, par le header "`X-Correlation-ID`" ou, s'il n'est pas présent, sera un nouvel id
généré.

Notez qu'un API démarré avec le générateur [generator-mtl-node-api]
aura déjà tout en place pour la gestion du correlation id.

Exemple :
```typescript
import { correlationIdMiddleware } from "@villedemontreal/correlation-id";

const app = express();
app.use(correlationIdMiddleware);
```

**Important!** : Si vous utilisez un middleware "`bodyParser`", assurez-vous que `correlationIdMiddleware` est enregistré
*après*, autrement une requête POST pourrait ne pas trouver le correlation id du context correctement!

### Obtention du correlation id

Exemple :
```typescript
import { correlationIdService, CorrelationId } from "@villedemontreal/correlation-id";

// Controller to update an account: PUT /accounts/:inum
public async update(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {

    // Get Correlation ID
    let cid: CorrelationId = correlationIdService.getId();
    console.log(cid);
}
```

# Builder le projet

**Note**: Sur Linux/Mac assurz-vous que le fichier `run` est exécutable. Autrement, lancez `chmod +x ./run`.

Pour lancer le build :

- > `run compile` ou `./run compile` (sur Linux/Mac)

Pour lancer les tests :

- > `run test` ou `./run test` (sur Linux/Mac)

# Mode Watch

Lors du développement, il est possible de lancer `run watch` (ou `./run watch` sur Linux/mac) dans un terminal
externe pour démarrer la compilation incrémentale. Il est alors possible de lancer certaines _launch configuration_
comme `Debug current tests file - fast` dans VsCode et ainsi déboguer le fichier de tests présentement ouvert sans
avoir à (re)compiler au préalable (la compilation incrémentale s'en sera chargé).

Notez que, par défaut, des _notifications desktop_ sont activées pour indiquer visuellement si la compilation
incrémentale est un succès ou si une erreur a été trouvée. Vous pouvez désactiver ces notifications en utilisant
`run watch --dn` (`d`isable `n`otifications).

# Déboguer le projet

Trois "_launch configurations_" sont founies pour déboguer le projet dans VSCode :

- "`Debug all tests`", la launch configuration par défaut. Lance les tests en mode debug. Vous pouvez mettre
  des breakpoints et ils seront respectés.

- "`Debug a test file`". Lance _un_ fichier de tests en mode debug. Vous pouvez mettre
  des breakpoints et ils seront respectés. Pour changer le fichier de tests à être exécuté, vous devez modifier la ligne appropriée dans le fichier "`.vscode/launch.json`".

- "`Debug current tests file`". Lance le fichier de tests _présentement ouvert_ dans VSCode en mode debug. Effectue la compîlation au préalable.

- "`Debug current tests file - fast`". Lance le fichier de tests _présentement ouvert_ dans VSCode en mode debug. Aucune compilation
  n'est effectuée au préalable. Cette launch configuration doit être utilisée lorsque la compilation incrémentale roule (voir la section "`Mode Watch`" plus haut)

# Aide / Contributions

Notez que les contributions sous forme de pull requests sont bienvenues.

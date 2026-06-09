# Deep Phishing >=>

Integrantes:
- Leonardo de Melo Soares
- Daniel Machado
- Isac Freire dos Santos
- Felipe de Jesus
- Bruno da Cruz Mendonça

## Contexto

Phishing é uma das táticas de cibersegurança mais antigas da internet, ela consiste em um atacante utilizar de uma “isca” digital, algo em que o atacante se passa por outra organização, que fará a vítima pensar que é legítimo e realizar o que o atacante quer, como por exemplo uma página de login idêntica a de outro site que fará a vítima entregar suas informações ao atacante.  

Pode-se destacar a URL como principal ferramenta no phishing, pois é por ela que a vítima irá clicar e ser redirecionada para um site do atacante, podendo ter roubo de credenciais, dados sensíveis, ou até infecção por malware ao baixar algo ao carregar a página. Para a URL se passar como legítima e fazer o usuário clicar nela, os atacantes utilizam de algumas técnicas como erros de digitação secretos (typosquatting), utilização de caracteres visualmente idênticos aos caracteres latinos (IDN spoofing), uso de subdomínios enganosos e encurtadores de URL que redirecionam ao site do atacante.  

Esse tipo de ataque se mantém ainda muito relevante nos dias de hoje. De acordo com a *Anti-Phishing Working Group* (APWG), o ano de 2025 registrou 3,8 milhões de ataques de phishing, com uma explosão massiva de golpes do tipo em redes sociais, mensagens SMS e e-mail empresarial. O combate ao phishing é essencial para a segurança de todos, sendo preciso o combater para garantir a proteção dos dados e financeiro dos indivíduos e das empresas, como demonstrado pelo relatório *Cost of a Data Breach* da IBM, que fala como o custo médio global de vazamento de dados de 2025 é de 4 milhões de dólares.

## Solução

Para combater o phishing, geralmente é verificado se a URL é potencialmente maliciosa, como padrão da indústria, usa-se primeiro uma filtragem dos links maliciosos já conhecidos, com sistemas como Google Safe Browsing ou Cisco Talos, que bloqueiam a URL se estiver na lista. Entretanto, essa é uma prática inerentemente reativa, e que falha em detectar ataques com URLs novas. E então vem o Machine Learning, com modelos especializados nisso que conseguem aprender padrões léxicos e classificar uma URL como maliciosa ou não, geralmente sendo treinados utilizando os algoritmos Gradient Boosting (XGBoost ou LightGBM) e Random Forest.  

O que pretendemos neste projeto é fazer uma comparação de desempenho entre diferentes algoritmos para essa classificação, vendo a partir de diferentes métricas quais algoritmos se saem melhor pelo melhor tempo e disponibilizando os resultados em uma página web para a visualização, determinando a relação entre taxa de acerto e custo computacional dos modelos, e interação, podendo identificar se uma URL informada pelo usuário é considerada como phishing. Os modelos serão treinados com o dataset PhiUSIIL Phishing URL, que é um dataset recente, com mais de 235 mil URLs e 54 features.

## Análise exploratória de dados

Realizaremos uma análise prévia do dataset para saber de sua natureza e adquirir certos insights antes de treinar o modelo efetivamente.

## Tecnologias

Para os modelos e o webservice que irá chamá-lo, iremos usar **Python**, com a biblioteca **Scikit-learn** tendo os algoritmos escolhidos já implementados, e **FastAPI** para o webservice. A página web será construída usando React e TypeScript.

## Métodos Supervisionados

Realizaremos comparação entre 3 algoritmos:

- **Árvore de Decisão**, que nos permitirá ter um modelo base e visualizar quais features o modelo usa;  
- **Random Forest** e **XGBoost**, que são os padrões da indústria e nos dará um modelo baseado em árvores mais preciso.

Os modelos passarão por **Stratified K-Fold Cross Validation**, para garantir que o modelo não irá apenas decorar os dados de treino e consiga ser treinado sem ser afetado pelo desbalanço do dataset, e **Grid Search**, para garantir que a comparação seja justa, avaliando os algoritmos com seus hiperparâmetros otimizados.

## Métodos Não Supervisionados

Como o dataset contém mais de 50 features, há chance do modelo perder eficiência e ter um tempo de processamento muito alto, causando o que é chamado de “Maldição da Dimensionalidade”. Por conta disso, aplicaremos o PCA para comprimir o dataset em uma quantidade menor de colunas que mais tenham relevância para resumir a natureza dos dados do dataset, com a expectativa de ter duas grandes nuvens de pontos distintas ao fazer o plot dos dados, uma de URLs legítimas e outra de URLs de phishing.  

O primeiro modelo será treinado usando o algoritmo de clusterização com k-means, para ver quais grupos de URLs são mais similares baseados em suas características. E para comparar com esse modelo, faremos um modelo com o algoritmo Isolation Forest, que identificará os outliers que nesse caso são as URLs de phishing.

## Métricas

Temos como falso positivo o bloqueio de um site seguro, e o falso negativo o deixar passar um site fraudulento, o que tem pesos diferentes a depender do contexto, desta forma contaremos com diferentes métricas para a comparação:

- **Matriz de confusão**: permitirá visualizar os quatro tipos de resultados para a classificação  
- **Precision**: medir a taxa de falsos positivos, garantindo que o modelo não está bloqueando domínios de empresas verdadeiras  
- **Recall**: medir a taxa de falsos negativos, garantindo que a maioria das URLs de phishings foi interceptada  
- **F1-Score**: média harmônica entre precision e recall, para o desempate de modelos que se saíram bem em apenas uma das métricas  
- **Tempo de inferência**: medir quanto tempo o modelo leva para classificar os dados, sendo importante para detectar a URL antes da página carregar para o usuário

## Referências

PRASAD, Shina; REALPE-MUÑOZ, Pablo. **PhiUSIIL Phishing URL Dataset**. UCI Machine Learning Repository, 2024\. DOI: [https://doi.org/10.1016/j.cose.2023.103545](https://doi.org/10.1016/j.cose.2023.103545). Disponível em: [https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset](https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset). Acesso em: 1 jun. 2026\. 

ANTI-PHISHING WORKING GROUP (APWG). **Phishing Activity Trends Report**. \[S. l.\]: APWG, \[2025\]. Disponível em: [https://apwg.org/trendreports](https://apwg.org/trendreports). Acesso em: 1 jun. 2026\. 

IBM SECURITY. **Cost of a Data Breach Report**. \[S. l.\]: IBM, 2025\. Disponível em: [https://www.ibm.com/reports/data-breach](https://www.ibm.com/reports/data-breach). Acesso em: 1 jun. 2026\.

## Trabalhos relacionados

GUARIZI, Bianca Domingos; MASCARENHAS, Dalbert Matos; MORAES, Igor Monteiro. Phishing Guardian: Detecção de sites de phishing com Machine Learning. *In*: SIMPÓSIO BRASILEIRO DE CIBERSEGURANÇA (SBSEG), 25., 2025, Foz do Iguaçu/PR. **Anais** \[...\]. Porto Alegre: Sociedade Brasileira de Computação, 2025\. p. 693-709. Disponível em: [https://doi.org/10.5753/sbseg.2025.11491](https://doi.org/10.5753/sbseg.2025.11491). Acesso em: 1 jun. 2026\. 

JHA, Rashmi; KUNWAR, Gaurav. Machine Learning based URL Analysis for Phishing Detection. *In*: INTERNATIONAL CONFERENCE ON ADVANCE COMPUTING AND INNOVATIVE TECHNOLOGIES IN ENGINEERING (ICACITE), 3., 2023, Greater Noida, India. **Proceedings** \[...\]. IEEE Xplore, 2023\. Disponível em: [https://ieeexplore.ieee.org/document/10112057](https://ieeexplore.ieee.org/document/10112057). Acesso em: 1 jun. 2026\.  

GHALECHYAN, Hayk; ISRAYELYAN, Elina; ARAKELYAN, Avag; HOVHANNISYAN, Gerasim; DAVTYAN, Arman. Phishing URL detection with neural networks: an empirical study. **Scientific Reports**, \[S. l.\], v. 14, n. 1, art. 25134, 2024\. Disponível em: [https://www.nature.com/articles/s41598-024-74725-6](https://www.nature.com/articles/s41598-024-74725-6). Acesso em: 1 jun. 2026\.   

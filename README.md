# Express REST API with TypeScript

이 레포지토리는 `Express`와 `TypeScript`를 사용하여 REST API를 구축하고, 이를 테스트하기 위한 샘플 프로젝트입니다. 이 프로젝트는 TypeScript 기반의 RESTful API 서버 개발과 테스트에 대한 이해를 돕기 위해 만들어졌습니다.

## 목차

- [프로젝트 개요](#프로젝트-개요)
- [기술 스택](#기술-스택)
- [설치 및 실행 방법](#설치-및-실행-방법)
- [API 엔드포인트](#api-엔드포인트)
- [테스트](#테스트)
- [빌드](#빌드)

## 프로젝트 개요

`Express`와 `TypeScript`를 사용하여 간단한 REST API 서버를 구축하고 테스트합니다. TypeScript의 타입 시스템을 통해 코드의 안정성을 높이고, RESTful API의 설계 및 구현 방법을 학습할 수 있습니다.

## 기술 스택

- Node.js
- TypeScript
- Express
- Jest (테스트)
- ts-node-dev (개발용 서버)

## 설치 및 실행 방법

1. **프로젝트 클론**

   ```bash
   git clone <repository_url>
   cd <repository_name>
   ```

2. **패키지 설치**

   ```bash
   npm install
   npm install -g ts-node
   ```

3. **개발 서버 실행**

   ```bash
   npm run dev
   ```

   기본 서버 포트는 `http://localhost:3000`입니다. 환경에 따라 `.env` 파일을 설정할 수 있습니다.

4. **빌드**

   ```bash
   npm run build
   ```

   `dist/` 디렉토리에 컴파일된 JavaScript 파일들이 생성됩니다.

## 테스트

이 프로젝트에는 `Jest`를 사용한 테스트가 포함되어 있습니다. 다음 명령어를 통해 테스트를 실행할 수 있습니다:

```bash
ts-node index.ts
```

테스트 커버리지를 확인하려면:

```bash
npm run test:coverage
```

## 기여

버그 제보, 개선 사항 제안 및 코드 기여를 환영합니다. 기여를 원하시면 새로운 브랜치를 생성하고 PR(Pull Request)을 제출해 주세요.

---

이 문서가 프로젝트를 이해하고 사용하는 데 도움이 되길 바랍니다. 질문이 있는 경우 Issues 섹션에 남겨주세요.

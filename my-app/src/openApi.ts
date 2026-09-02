// src/openapi.ts
export const openApiDoc = {
  openapi: "3.0.0",
  info: {
    title: "SANSUN学園 成績管理システム API",
    version: "1.0.0",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "session",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: { message: { type: "string" } },
      },
    },
  },
  security: [{ cookieAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        tags: ["auth"],
        summary: "ログイン",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "ログイン成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    role: {
                      type: "string",
                      enum: ["teacher", "full_time_teacher"],
                    },
                    mustChangePassword: { type: "boolean" },
                  },
                },
              },
            },
          },
          "401": { description: "認証失敗" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["auth"],
        summary: "ログアウト",
        responses: { "200": { description: "OK" } },
      },
    },
    "/auth/forgot-password": {
      post: {
        tags: ["auth"],
        summary: "パスワード再設定メール送信",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "OK" } },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["auth"],
        summary: "トークンによるパスワード再設定",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword"],
                properties: {
                  token: { type: "string" },
                  newPassword: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "400": { description: "トークン無効/期限切れ" },
        },
      },
    },
    "/auth/change-password": {
      post: {
        tags: ["auth"],
        summary: "パスワード変更（初回強制変更含む）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: { type: "string" },
                  newPassword: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "OK" } },
      },
    },
    "/auth/me": {
      get: {
        tags: ["auth"],
        summary: "ログイン中ユーザー情報",
        responses: { "200": { description: "OK" } },
      },
    },

    "/masters/majors": {
      get: {
        tags: ["masters"],
        summary: "専攻一覧",
        responses: { "200": { description: "OK" } },
      },
    },
    "/masters/majors/import": {
      post: {
        tags: ["masters"],
        summary: "専攻CSV取り込み（専任職員のみ）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { csv: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "422": { description: "バリデーションエラー" },
        },
      },
    },
    "/masters/subjects": {
      get: {
        tags: ["masters"],
        summary: "科目一覧",
        parameters: [
          { name: "year", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/masters/subjects/import": {
      post: {
        tags: ["masters"],
        summary: "科目CSV取り込み（専任職員のみ）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { csv: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "422": { description: "バリデーションエラー" },
        },
      },
    },
    "/masters/students": {
      get: {
        tags: ["masters"],
        summary: "学生一覧",
        responses: { "200": { description: "OK" } },
      },
    },
    "/masters/students/import": {
      post: {
        tags: ["masters"],
        summary: "学生CSV取り込み（専任職員のみ）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { csv: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "422": { description: "バリデーションエラー" },
        },
      },
    },
    "/masters/teachers": {
      get: {
        tags: ["masters"],
        summary: "講師一覧",
        responses: { "200": { description: "OK" } },
      },
    },
    "/masters/teachers/import": {
      post: {
        tags: ["masters"],
        summary: "講師CSV取り込み（専任職員のみ）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { csv: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "422": { description: "バリデーションエラー" },
        },
      },
    },
    "/masters/full-time-teachers": {
      get: {
        tags: ["masters"],
        summary: "専任職員一覧",
        responses: { "200": { description: "OK" } },
      },
    },
    "/masters/full-time-teachers/import": {
      post: {
        tags: ["masters"],
        summary: "専任職員CSV取り込み（専任職員のみ）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { csv: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "422": { description: "バリデーションエラー" },
        },
      },
    },

    "/relations/teacher-subject": {
      get: {
        tags: ["relations"],
        summary: "講師・科目紐づけ一覧",
        parameters: [
          { name: "year", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/relations/teacher-subject/import": {
      post: {
        tags: ["relations"],
        summary: "講師・科目紐づけCSV取り込み（専任職員のみ）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { csv: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "422": { description: "バリデーションエラー" },
        },
      },
    },
    "/relations/student-subject": {
      get: {
        tags: ["relations"],
        summary: "学生・科目紐づけ一覧",
        parameters: [
          { name: "subjectId", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/relations/student-subject/import": {
      post: {
        tags: ["relations"],
        summary: "学生・科目紐づけCSV取り込み（専任職員のみ）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { csv: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "422": { description: "バリデーションエラー" },
        },
      },
    },

    "/weights": {
      get: {
        tags: ["weights"],
        summary: "重み一覧",
        parameters: [
          { name: "subjectId", in: "query", schema: { type: "integer" } },
          { name: "year", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "OK" } },
      },
      post: {
        tags: ["weights"],
        summary: "重み登録（講師のみ、担当科目のみ）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "subjectId",
                  "year",
                  "term",
                  "attendanceRateWeight",
                  "attitudeClassWeight",
                  "homeworkEvaluationWeight",
                ],
                properties: {
                  subjectId: { type: "integer" },
                  year: { type: "integer" },
                  term: { type: "integer" },
                  attendanceRateWeight: { type: "integer" },
                  attitudeClassWeight: { type: "integer" },
                  homeworkEvaluationWeight: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "作成成功" },
          "400": { description: "重み合計が10でない" },
        },
      },
    },
    "/weights/current": {
      get: {
        tags: ["weights"],
        summary: "指定科目・年度・学期の現在の重み",
        parameters: [
          {
            name: "subjectId",
            in: "query",
            required: true,
            schema: { type: "integer" },
          },
          {
            name: "year",
            in: "query",
            required: true,
            schema: { type: "integer" },
          },
          {
            name: "term",
            in: "query",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "OK" },
          "404": { description: "未設定" },
        },
      },
    },
    "/weights/{id}": {
      patch: {
        tags: ["weights"],
        summary: "重み更新（講師のみ、担当科目のみ）",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "OK" },
          "403": { description: "担当外の科目" },
        },
      },
    },

    "/grades": {
      get: {
        tags: ["grades"],
        summary: "成績一覧（講師は過去3年分、専任職員は全期間）",
        responses: { "200": { description: "OK" } },
      },
      post: {
        tags: ["grades"],
        summary: "成績登録（講師のみ、担当科目のみ）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["studentId", "subjectId", "year", "term"],
                properties: {
                  studentId: { type: "integer" },
                  subjectId: { type: "integer" },
                  year: { type: "integer" },
                  term: { type: "integer" },
                  attendanceRate: { type: "integer", minimum: 1, maximum: 100 },
                  attitudeClass: { type: "integer", minimum: 1, maximum: 10 },
                  homeworkEvaluation: {
                    type: "integer",
                    minimum: 1,
                    maximum: 10,
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "作成成功" },
          "403": { description: "担当外の科目 or 確定済み年度" },
          "422": { description: "既に登録済み" },
        },
      },
    },
    "/grades/{id}": {
      patch: {
        tags: ["grades"],
        summary: "成績更新",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "OK" },
          "403": { description: "担当外 or 確定済み年度" },
        },
      },
    },
    "/grades/subject/{subjectId}": {
      get: {
        tags: ["grades"],
        summary: "科目別成績一覧",
        parameters: [
          {
            name: "subjectId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/grades/student/{studentId}": {
      get: {
        tags: ["grades"],
        summary: "個人別成績一覧",
        parameters: [
          {
            name: "studentId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/grades/validate": {
      get: {
        tags: ["grades"],
        summary: "未入力・不可の成績一覧（専任職員のみ）",
        responses: { "200": { description: "OK" } },
      },
    },
    "/grades/calculate": {
      post: {
        tags: ["grades"],
        summary: "指定科目・学期の成績を重みに基づき一括再計算",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["subjectId", "year", "term"],
                properties: {
                  subjectId: { type: "integer" },
                  year: { type: "integer" },
                  term: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "404": { description: "重み未設定" },
        },
      },
    },

    "/years": {
      get: {
        tags: ["years"],
        summary: "年度確定状況一覧",
        responses: { "200": { description: "OK" } },
      },
    },
    "/years/current": {
      get: {
        tags: ["years"],
        summary: "現在年度の確定状況",
        responses: { "200": { description: "OK" } },
      },
    },
    "/years/close": {
      post: {
        tags: ["years"],
        summary: "年度確定（専任職員のみ）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["year"],
                properties: { year: { type: "integer" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "400": { description: "未入力成績あり" },
        },
      },
    },
    "/years/{yearId}/lock": {
      patch: {
        tags: ["years"],
        summary: "年度ロック（専任職員のみ）",
        parameters: [
          {
            name: "yearId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "OK" } },
      },
    },

    "/reports/overview": {
      get: {
        tags: ["reports"],
        summary: "専任職員ホーム画面: 生徒×科目の成績一覧（専任職員のみ）",
        parameters: [
          { name: "year", in: "query", schema: { type: "integer" } },
          { name: "term", in: "query", schema: { type: "integer" } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "incomplete", in: "query", schema: { type: "boolean" } },
          { name: "fail", in: "query", schema: { type: "boolean" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/reports/subject/{subjectId}": {
      get: {
        tags: ["reports"],
        summary: "科目別成績表",
        parameters: [
          {
            name: "subjectId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/reports/student/{studentId}": {
      get: {
        tags: ["reports"],
        summary: "個人別成績表",
        parameters: [
          {
            name: "studentId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
          { name: "from", in: "query", schema: { type: "integer" } },
          { name: "to", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/reports/student/{studentId}/pdf": {
      get: {
        tags: ["reports"],
        summary: "個人別成績表PDF（未実装）",
        parameters: [
          {
            name: "studentId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "501": { description: "未実装" } },
      },
    },
    "/reports/subject/{subjectId}/pdf": {
      get: {
        tags: ["reports"],
        summary: "科目別成績表PDF（未実装）",
        parameters: [
          {
            name: "subjectId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "501": { description: "未実装" } },
      },
    },

    "/csv/export/{type}": {
      get: {
        tags: ["csv"],
        summary: "マスタCSVエクスポート（専任職員のみ）",
        parameters: [
          {
            name: "type",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: [
                "subjects",
                "students",
                "teachers",
                "full-time-teachers",
                "majors",
              ],
            },
          },
        ],
        responses: { "200": { description: "text/csv" } },
      },
    },
  },
} as const;

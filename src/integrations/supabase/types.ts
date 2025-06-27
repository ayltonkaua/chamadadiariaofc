export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      alunos: {
        Row: {
          created_at: string | null
          id: string
          matricula: string
          nome: string
          turma_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          matricula: string
          nome: string
          turma_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          matricula?: string
          nome?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alunos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "alunos_faltosos"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "alunos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas: {
        Row: {
          aluno_id: string
          created_at: string | null
          data_chamada: string
          id: string
          presente: boolean
          turma_id: string
          escola_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string | null
          data_chamada: string
          id?: string
          presente?: boolean
          turma_id: string
          escola_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string | null
          data_chamada?: string
          id?: string
          presente?: boolean
          turma_id?: string
          escola_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos_faltosos"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "alunos_faltosos"
            referencedColumns: ["turma_id"]
          },
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escola_configuracao"
            referencedColumns: ["id"]
          }
        ]
      }
      turmas: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          numero_sala: string
          user_id: string | null
          escola_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          numero_sala?: string
          user_id?: string | null
          escola_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          numero_sala?: string
          user_id?: string | null
          escola_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turmas_escola_id_fkey",
            columns: ["escola_id"],
            isOneToOne: false,
            referencedRelation: "escola_configuracao",
            referencedColumns: ["id"]
          }
        ]
      }
      atestados: {
        Row: {
          id: string;
          aluno_id: string;
          data_inicio: string;
          data_fim: string;
          descricao: string;
          status: 'pendente' | 'aprovado' | 'rejeitado';
          created_at: string;
        };
        Insert: {
          id?: string;
          aluno_id: string;
          data_inicio: string;
          data_fim: string;
          descricao: string;
          status?: 'pendente' | 'aprovado' | 'rejeitado';
          created_at?: string;
        };
        Update: {
          id?: string;
          aluno_id?: string;
          data_inicio?: string;
          data_fim?: string;
          descricao?: string;
          status?: 'pendente' | 'aprovado' | 'rejeitado';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "atestados_aluno_id_fkey",
            columns: ["aluno_id"],
            isOneToOne: false,
            referencedRelation: "alunos",
            referencedColumns: ["id"]
          }
        ];
      },
      justificativas_faltas: {
        Row: {
          id: string;
          aluno_id: string;
          data: string;
          motivo: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          aluno_id: string;
          data: string;
          motivo: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          aluno_id?: string;
          data?: string;
          motivo?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "justificativas_faltas_aluno_id_fkey",
            columns: ["aluno_id"],
            isOneToOne: false,
            referencedRelation: "alunos",
            referencedColumns: ["id"]
          }
        ];
      },
      escola_configuracao: {
        Row: {
          id: string;
          nome: string;
          endereco: string;
          telefone: string;
          email: string;
          criado_em: string;
          atualizado_em: string;
          cor_primaria: string;
          cor_secundaria: string;
          url_logo: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          endereco: string;
          telefone: string;
          email: string;
          criado_em?: string;
          atualizado_em?: string;
          cor_primaria: string;
          cor_secundaria: string;
          url_logo?: string | null;
        };
        Update: {
          id?: string;
          nome?: string;
          endereco?: string;
          telefone?: string;
          email?: string;
          criado_em?: string;
          atualizado_em?: string;
          cor_primaria?: string;
          cor_secundaria?: string;
          url_logo?: string | null;
        };
        Relationships: [];
      },
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          escola_id: string;
          role: 'admin' | 'diretor' | 'coordenador' | 'professor' | 'secretario';
          criado_em: string | null;
          atualizado_em: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          escola_id: string;
          role: 'admin' | 'diretor' | 'coordenador' | 'professor' | 'secretario';
          criado_em?: string | null;
          atualizado_em?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          escola_id?: string;
          role?: 'admin' | 'diretor' | 'coordenador' | 'professor' | 'secretario';
          criado_em?: string | null;
          atualizado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_escola_id_fkey",
            columns: ["escola_id"],
            isOneToOne: false,
            referencedRelation: "escola_configuracao",
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey",
            columns: ["user_id"],
            isOneToOne: false,
            referencedRelation: "users",
            referencedColumns: ["id"]
          }
        ];
      },
    }
    Views: {
      alunos_faltosos: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          matricula: string | null
          total_faltas: number | null
          turma_id: string | null
          turma_nome: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      criar_escola_e_associar_admin: {
        Args: {
          nome_escola: string;
          endereco_escola: string;
          telefone_escola: string;
          email_escola: string;
          url_logo_escola?: string | null;
          cor_primaria_escola?: string | null;
          cor_secundaria_escola?: string | null;
        };
        Returns: string;
      };
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

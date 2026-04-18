data "aws_vpc" "tooling" {
  tags = {
    Name = "tooling-prod"
  }
}

data "aws_subnets" "database" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.tooling.id]
  }
  tags = {
    Name = "*database*"
  }
}

data "aws_security_group" "eks_nodes" {
  tags = {
    Name = "*node*"
  }
  vpc_id = data.aws_vpc.tooling.id
}

resource "aws_db_subnet_group" "gitpulse" {
  name       = "gitpulse"
  subnet_ids = data.aws_subnets.database.ids
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name        = "gitpulse/db-password"
  description = "GitPulse RDS password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

resource "aws_security_group" "db" {
  name_prefix = "gitpulse-db-"
  vpc_id      = data.aws_vpc.tooling.id
  description = "GitPulse RDS security group"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [data.aws_security_group.eks_nodes.id]
    description     = "PostgreSQL from EKS nodes"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "gitpulse" {
  identifier     = "gitpulse"
  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "gitpulse"
  username = "gitpulse"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.gitpulse.name
  vpc_security_group_ids = [aws_security_group.db.id]

  backup_retention_period = 7
  backup_window           = "07:00-08:00"
  maintenance_window      = "sun:08:00-sun:09:00"

  skip_final_snapshot       = false
  final_snapshot_identifier = "gitpulse-final"
  deletion_protection       = true

  performance_insights_enabled = true
}

output "rds_endpoint" {
  value = aws_db_instance.gitpulse.endpoint
}

output "rds_address" {
  value = aws_db_instance.gitpulse.address
}
